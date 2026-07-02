import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
  console.log('VectorGrep extension activated');

  const provider = new VectorGrepSidebarProvider(context.extensionUri);
  const indexedDocuments = new Map<string, number>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const autoIndexDocument = async (document?: vscode.TextDocument) => {
    if (!document || document.isUntitled || document.uri.scheme !== 'file') {
      return;
    }

    const filePath = document.uri.fsPath;
    const previousVersion = indexedDocuments.get(filePath);

    if (previousVersion === document.version) {
      return;
    }

    try {
      const response = await axios.post('https://harshgarg10-vectorgrep-backend.hf.space/index_file', {
        file_path: filePath,
        source_code: document.getText(),
      });

      indexedDocuments.set(filePath, document.version);
      console.log('Auto-indexed file:', filePath, response.data);
    } catch (error) {
      console.error('Failed to auto-index file:', filePath, error);
    }
  };

  const scheduleAutoIndexDocument = (document?: vscode.TextDocument) => {
    if (!document || document.isUntitled || document.uri.scheme !== 'file') {
      return;
    }

    const filePath = document.uri.fsPath;
    const existingTimer = debounceTimers.get(filePath);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      debounceTimers.delete(filePath);
      void autoIndexDocument(document);
    }, 500);

    debounceTimers.set(filePath, timer);
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VectorGrepSidebarProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      scheduleAutoIndexDocument(document);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      scheduleAutoIndexDocument(editor?.document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      scheduleAutoIndexDocument(document);
    })
  );

  void autoIndexDocument(vscode.window.activeTextEditor?.document);
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
      if (message.command === 'open-result') {
        await this.openSearchResult(message.result);
      }

      if (message.command === 'search') {
        console.log('Search query from webview:', message.query);

        const activeEditor = vscode.window.activeTextEditor;

        if (activeEditor) {
          try {
            await axios.post('https://harshgarg10-vectorgrep-backend.hf.space/index_file', {
              file_path: activeEditor.document.uri.fsPath,
              source_code: activeEditor.document.getText(),
            });
          } catch (error) {
            console.error('Failed to refresh index before search:', error);
          }
        }

        try {
          const response = await axios.get('https://harshgarg10-vectorgrep-backend.hf.space/search', {
            params: {
              q: message.query,
              limit: 5,
              file_path: activeEditor?.document.uri.fsPath,
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

  private async openSearchResult(result: any): Promise<void> {
    const metadata = result?.metadata;

    if (!metadata?.file_path) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(metadata.file_path));
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
    });

    const documentText = document.getText();
    const functionText = result?.text || '';
    const functionName = metadata.name || '';

    let startOffset = -1;

    if (functionText) {
      startOffset = documentText.indexOf(functionText);
    }

    if (startOffset === -1 && functionName) {
      startOffset = documentText.indexOf(`def ${functionName}`);
    }

    if (startOffset === -1) {
      startOffset = Math.max(documentText.indexOf(documentText.trim()), 0);
    }

    const startPosition = document.positionAt(startOffset);
    const endPosition = document.positionAt(startOffset + Math.max(functionText.length, functionName.length));
    const selection = new vscode.Selection(startPosition, endPosition);

    editor.selection = selection;
    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
    await vscode.commands.executeCommand('editor.action.addSelectionToNextFindMatch');
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
          .toolbar {
            display: flex;
            gap: 8px;
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
            cursor: pointer;
          }
          .result-card.active {
            border-color: #4fc3f7;
            box-shadow: 0 0 0 1px #4fc3f7 inset;
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
          <div class="toolbar">
            <button id="searchBtn">Search</button>
            <button id="nextBtn" disabled>Next Result</button>
          </div>
          <div id="status"></div>
          <div id="results"></div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const searchBtn = document.getElementById('searchBtn');
          const nextBtn = document.getElementById('nextBtn');
          const queryInput = document.getElementById('query');
          const statusContainer = document.getElementById('status');
          const resultsContainer = document.getElementById('results');

          let currentResults = [];
          let currentResultIndex = -1;

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
              currentResults = [];
              currentResultIndex = -1;
              nextBtn.disabled = true;
              resultsContainer.innerHTML = '<p class="error">' + (payload?.message || 'Search failed') + '</p>';
              return;
            }

            currentResults = payload.results || [];

            if (currentResults.length === 0) {
              currentResultIndex = -1;
              nextBtn.disabled = true;
              resultsContainer.innerHTML = '<p>No matches found.</p>';
              return;
            }

            if (currentResultIndex === -1 || currentResultIndex >= currentResults.length) {
              currentResultIndex = 0;
            }

            nextBtn.disabled = currentResults.length <= 1;

            resultsContainer.innerHTML = currentResults.map((item, index) => {
              const metadata = item.metadata || {};
              const isActive = index === currentResultIndex;
              return [
                '<div class="result-card ' + (isActive ? 'active' : '') + '" data-index="' + index + '">',
                '<div class="result-title">' + (metadata.name || 'Unnamed function') + '</div>',
                '<div class="result-meta">' + (metadata.file_path || '') + ' | distance: ' + (item.distance ?? 'n/a') + '</div>',
                '<pre>' + (item.text || '') + '</pre>',
                '</div>',
              ].join('');
            }).join('');

            document.querySelectorAll('.result-card').forEach((card) => {
              card.addEventListener('click', () => {
                const index = Number(card.getAttribute('data-index'));
                openResult(index);
              });
            });
          }

          function openResult(index) {
            if (!currentResults.length) {
              return;
            }

            const normalizedIndex = ((index % currentResults.length) + currentResults.length) % currentResults.length;
            currentResultIndex = normalizedIndex;
            renderResults({ status: 'success', results: currentResults });
            vscode.postMessage({ command: 'open-result', result: currentResults[currentResultIndex] });
          }

          nextBtn.addEventListener('click', () => {
            openResult(currentResultIndex + 1);
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
              if (message.payload && message.payload.results && message.payload.results.length > 0) {
                openResult(0);
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}