import json
import hashlib
from tree_sitter import Parser, Tree, Language
import tree_sitter_python as tspython

def make_python_parser() -> Parser:
    parser = Parser()
    parser.language = Language(tspython.language())
    return parser

def parse_source(source: str, parser: Parser) -> Tree:

    source_bytes = source.encode("utf-8")
    return parser.parse(source_bytes)

def hash_function_record(payload: dict) -> str:

    payload_str = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload_str).hexdigest()

def extract_function_info(function_node) -> dict:
    name_node = function_node.child_by_field_name("name")
    function_name = name_node.text.decode("utf-8") if name_node else "anonymous"
    
    raw_text = function_node.text.decode("utf-8")

    content_payload = {
        "name": function_name,
        "text": raw_text
    }
    
    content_hash = hash_function_record(content_payload)
    function_record = {
        "name": function_name,
        "text": raw_text,
        "hash": content_hash,
        "start_byte": function_node.start_byte,
        "end_byte": function_node.end_byte,
        "start_point": [function_node.start_point[0], function_node.start_point[1]],
        "end_point": [function_node.end_point[0], function_node.end_point[1]],
    }
    
    return function_record

def extract_all_function_info(node) -> list[dict]:

    functions = []
    
    if node.type == "function_definition":
        functions.append(extract_function_info(node))

    for child in node.children:
        functions.extend(extract_all_function_info(child))
        
    return functions


if __name__ == "__main__":
    dummy_code = """
def calculate_revenue(user_id):
    '''Calculates the total revenue for a given user.'''
    total = get_db_records(user_id)
    return total * 1.2

class User:
    def __init__(self, name):
        self.name = name
        
    def get_name(self):
        # Returns the user's name
        return self.name
"""
    
    parser = make_python_parser()
    tree = parse_source(dummy_code, parser)
    
    extracted_functions = extract_all_function_info(tree.root_node)

    print(f"Extracted {len(extracted_functions)} functions successfully!\n")
    for func in extracted_functions:
        print(json.dumps(func, indent=2))