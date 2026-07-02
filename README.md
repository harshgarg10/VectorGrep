# VectorGrep

VectorGrep is a VSCode extension that provides semantic code search. Instead of searching by exact text or regular expressions, VectorGrep understands the *meaning* of your code using machine learning embeddings and AST extraction.

## Features

- **Semantic Code Search**: Find functions and classes by describing what they do, rather than remembering the exact syntax.
- **Auto-Indexing**: VectorGrep automatically tracks, embeds, and indexes your code into a local ChromaDB vector database as you write, save, or switch tabs.
- **Instant Navigation**: Click on any search result to instantly navigate to that exact function in your editor.

## Prerequisites

VectorGrep runs entirely locally to preserve your privacy! This means your code is never sent to the cloud. Because of this, you must run the local ML backend.

You will need:
- **Python 3.10+** installed on your system.

## Setup & Installation

To use this extension, follow these steps to get the local ML backend running:

1. **Install the Extension**
   - Install the provided `vectorgrep-x.x.x.vsix` file into your VSCode by going to the Extensions tab -> Click the `...` menu in the top right -> **Install from VSIX...**

2. **Clone the Backend Repository**
   - Download or clone the VectorGrep source code folder to your local machine.

3. **Install Dependencies**
   - Open a terminal inside the backend folder.
   - It is highly recommended to use a virtual environment:
     ```bash
     python -m venv .venv
     # Windows
     .venv\Scripts\activate
     # Mac/Linux
     source .venv/bin/activate
     ```
   - Install the required ML packages:
     ```bash
     pip install -r requirements.txt
     ```
     *(Note: This includes heavy packages like PyTorch, SentenceTransformers, and ChromaDB).*

4. **Run the Backend Server**
   - Start the FastAPI backend server:
     ```bash
     uvicorn VectorGrep.main:app
     ```
   - *Note: On the very first run, it will download the `all-MiniLM-L6-v2` AI model, which might take a few minutes depending on your internet connection.*

## Usage

1. Open any Python file in VSCode. 
2. Open the **VectorGrep Sidebar** (look for its icon in your Activity Bar on the left).
3. Type a natural language query in the search box (e.g. "Calculate the average of the student marks").
4. Press **Search**.
5. Click on the most relevant result card, and VSCode will jump straight to the source code!

## Architecture

- **Frontend:** VSCode Extension (TypeScript / Webview)
- **Backend:** FastAPI (Python)
- **AST Parsing:** Tree-sitter (Python)
- **Embeddings:** SentenceTransformers (`all-MiniLM-L6-v2`)
- **Vector Database:** ChromaDB

---

**Enjoy Semantic Code Searching!**
