from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

from indexer import index_source_code, search_codebase


app = FastAPI(
    title="Semantic Code Search API",
    description="Microservice for embedding and searching code using AST and Vector DB."
)

class IndexRequest(BaseModel):
    file_path: str
    source_code: str

@app.post("/index_file")
async def index_file_endpoint(request: IndexRequest):
    try:
        print(f"Received indexing request for: {request.file_path}")
        index_source_code(request.source_code, request.file_path)
        
        return {
            "status": "success",
            "message": f"Successfully processed and indexed {request.file_path}"
        }
        
    except Exception as e:
       
        print(f"Error indexing {request.file_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/search")
async def search_endpoint(q: str, limit: int = 5):
    try:
        print(f"Semantic Search triggered for: '{q}'")
        
        results = search_codebase(query=q, n_results=limit)
        
        return {
            "status": "success",
            "query": q,
            "results": results
        }
        
    except Exception as e:
        print(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("Starting Semantic Search API on port 8000...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
