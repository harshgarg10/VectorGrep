from tree_sitter import Parser,  Tree, Language
import tree_sitter_python as tspython

def parse_source(source: str, parser: Parser) -> Tree:
    source_bytes = source.encode("utf-8")
    return parser.parse(source_bytes)

def make_python_parser() -> Parser:
    parser = Parser()
    parser.language = Language(tspython.language())
    return parser

def inspect_tree(tree: Tree):
    root = tree.root_node
    print("root:", root.type)

    for child in root.children:
        print("child:", child.type)

        if child.type == "function_definition":
            for grandchild in child.children:
                print("  grandchild:", grandchild.type)

def inspect_function(tree: Tree):
    root = tree.root_node

    for child in root.children:
        if child.type == "function_definition":
            name_node = child.child_by_field_name("name")
            params_node = child.child_by_field_name("parameters")
            body_node = child.child_by_field_name("body")

            print("function name:", name_node.text.decode("utf-8"))
            print("parameters:", params_node.text.decode("utf-8"))
            print("body type:", body_node.type)

def inspect_function_body(tree: Tree):
    root  = tree.root_node
    for child in root.children:
        if child.type== "function_definition":
            body_node = child.child_by_field_name("body")
            for statement in body_node.named_children:
                print("statement type:", statement.type)
                print("statement text:", statement.text.decode("utf-8"))

def extract_function_info(tree: Tree) -> dict:
    root = tree.root_node
    for child in root.children:
        if child.type == "function_definition":
            name_node = child.child_by_field_name("name")
            params_node = child.child_by_field_name("parameters")
            body_node = child.child_by_field_name("body")
            return {
                "name": name_node.text.decode("utf-8"),
                "parameters": params_node.text.decode("utf-8"),
                "body": body_node.text.decode("utf-8")
            }
    return {}

if __name__ == "__main__":
    parser = make_python_parser()
    source = """def add(a, b):
    return a + b
"""
    tree = parse_source(source, parser)
    info = extract_function_info(tree)
    print(info)