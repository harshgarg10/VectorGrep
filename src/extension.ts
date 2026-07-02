import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
  console.log('VectorGrep extension activated');

  const provider = new VectorGrepSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VectorGrepSidebarProvider.viewType,
      provider
    )
  );
}

export function deactivate() {}

class VectorGrepSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vectorgrepSidebar';

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'index-current-file') {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          webviewView.webview.postMessage({
            command: 'index-status',
            payload: {
              status: 'error',
              message: 'No active editor found.',
            },
          });
          return;
        }

        const document = editor.document;

        try {
          const response = await axios.post('http://127.0.0.1:8000/index_file', {
            file_path: document.uri.fsPath,
            source_code: document.getText(),
          });

          webviewView.webview.postMessage({
            command: 'index-status',
            payload: response.data,
          });
        } catch (error) {
          console.error('Failed to index current file:', error);
          webviewView.webview.postMessage({
            command: 'index-status',
            payload: {
              status: 'error',
              message: 'Failed to contact backend for indexing.',
            },
          });
        }
      }

      if (message.command === 'search') {
        console.log('Search query from webview:', message.query);

        try {
          const response = await axios.get('http://127.0.0.1:8000/search', {
            params: {
              q: message.query,
              limit: 5,
              file_path: vscode.window.activeTextEditor?.document.uri.fsPath,
            },
          });

          console.log('Search results from backend:', response.data);
          webviewView.webview.postMessage({
            command: 'search-results',
            payload: response.data,
          });
        } catch (error) {
          console.error('Failed to call FastAPI backend:', error);
          webviewView.webview.postMessage({
            command: 'search-results',
            payload: {
              status: 'error',
              message: 'Failed to contact backend',
            },
          });
        }
      }
    });

    webviewView.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VectorGrep</title>
        <style>
          body {
            font-family: sans-serif;
            padding: 12px;
          }
          .container {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          input {
            padding: 8px;
            width: 100%;
            box-sizing: border-box;
          }
          button {
            padding: 8px 12px;
            cursor: pointer;
          }
          #results {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
          }
          .result-card {
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.04);
          }
          .result-title {
            font-weight: 700;
            margin-bottom: 4px;
          }
          .result-meta {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 6px;
          }
          .error {
            color: #ff8080;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h3>VectorGrep Search</h3>
          <p>If you can read this, the provider is rendering.</p>
          <input type="text" id="query" placeholder="Ask something about your code..." />
          <button id="indexBtn">Index Current File</button>
          <button id="searchBtn">Search</button>
          <div id="status"></div>
          <div id="results"></div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const indexBtn = document.getElementById('indexBtn');
          const searchBtn = document.getElementById('searchBtn');
          const queryInput = document.getElementById('query');
          const statusContainer = document.getElementById('status');
          const resultsContainer = document.getElementById('results');

          function renderStatus(payload) {
            if (!payload) {
              statusContainer.innerHTML = '';
              return;
            }

            if (payload.status === 'error') {
              statusContainer.innerHTML = '<p class="error">' + payload.message + '</p>';
              return;
            }

            statusContainer.innerHTML = '<p>' + (payload.message || 'Done') + '</p>';
          }

          function renderResults(payload) {
            if (!payload || payload.status === 'error') {
              resultsContainer.innerHTML = '<p class="error">' + (payload?.message || 'Search failed') + '</p>';
              return;
            }

            const results = payload.results || [];

            if (results.length === 0) {
              resultsContainer.innerHTML = '<p>No matches found.</p>';
              return;
            }

            resultsContainer.innerHTML = results.map((item) => {
              const metadata = item.metadata || {};
              return [
                '<div class="result-card">',
                '<div class="result-title">' + (metadata.name || 'Unnamed function') + '</div>',
                '<div class="result-meta">' + (metadata.file_path || '') + ' | distance: ' + (item.distance ?? 'n/a') + '</div>',
                '<pre>' + (item.text || '') + '</pre>',
                '</div>',
              ].join('');
            }).join('');
          }

          indexBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'index-current-file' });
          });

          searchBtn.addEventListener('click', () => {
            const query = queryInput.value;
            vscode.postMessage({ command: 'search', query });
          });

          window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.command === 'index-status') {
              renderStatus(message.payload);
            }
            if (message.command === 'search-results') {
              renderResults(message.payload);
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}