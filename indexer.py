from sentence_transformers import SentenceTransformer
import chromadb

from ast_extractor import make_python_parser, parse_source, extract_all_function_info

MODEL_NAME = "all-MiniLM-L6-v2"
CHROMA_PATH = "./chroma_db"


_model = None
_client = None
_collection = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"Loading ML Model '{MODEL_NAME}' into memory... (This happens once)")
        _model = SentenceTransformer(MODEL_NAME)
    return _model

def get_chroma_collection():
    global _client, _collection
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
    if _collection is None:
        _collection = _client.get_or_create_collection(name="codebase_index")
    return _collection

def embed_function_record(function_record: dict):
    model = get_model()
    embedding = model.encode(function_record["text"])
    return embedding.tolist()

def function_hash_exists(file_path: str, function_hash: str) -> bool:
    collection = get_chroma_collection()
    doc_id = f"{file_path}:{function_hash}"
    result = collection.get(ids=[doc_id])
    
    return len(result["ids"]) > 0

def upsert_function_record(function_record: dict, file_path: str):
    if function_hash_exists(file_path, function_record["hash"]):
        print(f"Skipping {function_record['name']} (Hash match: Unchanged)")
        return

    print(f"Embedding and saving updated function: {function_record['name']}")

    collection = get_chroma_collection()
    vector = embed_function_record(function_record)
    doc_id = f"{file_path}:{function_record['hash']}"

   
    collection.upsert(
        ids=[doc_id],
        embeddings=[vector],
        documents=[function_record["text"]],
        metadatas=[{
            "file_path": file_path,
            "name": function_record["name"],
            "hash": function_record["hash"],
            "start_byte": function_record["start_byte"],
            "end_byte": function_record["end_byte"],
            "start_point_row": function_record["start_point"][0],
            "start_point_col": function_record["start_point"][1],
            "end_point_row": function_record["end_point"][0],
            "end_point_col": function_record["end_point"][1],
        }],
    )

def index_function_records(function_records: list[dict], file_path: str):
    for function_record in function_records:
        upsert_function_record(function_record, file_path)

def index_source_code(source: str, file_path: str):
    parser = make_python_parser()
    tree = parse_source(source, parser)
    
   
    function_records = extract_all_function_info(tree.root_node)
    index_function_records(function_records, file_path)


if __name__ == "__main__":
    sample_source = """
def add(a, b):
    # Adds two numbers
    return a + b

def sub(a, b):
    return a - b
"""

    print("--- FIRST RUN (Should embed both) ---")
    index_source_code(sample_source, "math_utils.py")
    
    print("\n--- SECOND RUN (Should skip both) ---")
    index_source_code(sample_source, "math_utils.py")
    
    print("\n--- THIRD RUN (Developer edits the 'add' function) ---")
    modified_source = """
def add(a, b):
    # Adds two numbers and prints them!
    print(a, b)
    return a + b

def sub(a, b):
    return a - b
"""
    index_source_code(modified_source, "math_utils.py")
    print("\n Indexing test complete!")