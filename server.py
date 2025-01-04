from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    JSON,
    ForeignKey,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
from typing import List, Union, Optional, Dict
from datetime import datetime
from fastapi import UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
import shutil
from uuid import uuid4
from pathlib import Path

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ThreadDB(Base):
    __tablename__ = "threads"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    creator = Column(String, nullable=False)
    view_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)

    posts = relationship(
        "PostDB", back_populates="thread", cascade="all, delete-orphan"
    )
    documents = relationship(
        "DocumentDB", back_populates="thread", cascade="all, delete-orphan"
    )


class PostDB(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    author = Column(String, nullable=False)
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=False)
    text = Column(String, nullable=False)
    time = Column(DateTime, default=datetime.utcnow)
    # likes = Column(Integer, default=0)
    # replies = Column(Integer, default=0)
    image = Column(String, nullable=True)
    edited = Column(Boolean, default=False)
    seen = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    last_viewed = Column(DateTime, nullable=True)
    is_initial_post = Column(
        Boolean, default=False
    )  # To identify the first post in a thread

    thread = relationship("ThreadDB", back_populates="posts")


class DocumentDB(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    thread_id = Column(Integer, ForeignKey("threads.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_viewed = Column(DateTime, nullable=True)
    view_count = Column(Integer, default=0)

    thread = relationship("ThreadDB", back_populates="documents")


class ThreadBase(BaseModel):
    title: str
    creator: str


class ThreadCreate(ThreadBase):
    initial_post: str
    image: Optional[str] = None


class Thread(ThreadBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_activity: datetime
    view_count: int
    reply_count: int

    class Config:
        orm_mode = True


class ThreadWithPosts(Thread):
    posts: List["Post"]

    class Config:
        orm_mode = True


class CompleteThread(Thread):
    posts: List["Post"]
    documents: List["Document"]

    class Config:
        orm_mode = True


class PostBase(BaseModel):
    text: str
    image: Optional[str] = None


class PostCreate(PostBase):
    pass


class Post(PostBase):
    id: int
    thread_id: int
    author: str
    time: datetime
    # likes: int
    # replies: int
    edited: bool
    seen: bool
    view_count: int
    last_viewed: Optional[datetime]
    is_initial_post: bool

    class Config:
        orm_mode = True


class DocumentBase(BaseModel):
    title: str
    thread_id: int
    content: Union[str, List[List[str]]]
    type: str


class DocumentCreate(DocumentBase):
    pass


class Document(DocumentBase):
    id: str
    created_at: datetime
    updated_at: datetime
    last_viewed: Optional[datetime]
    view_count: int

    class Config:
        orm_mode = True


INITIAL_DOCUMENTS = {}
INITIAL_POSTS = []


def init_db():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    if db.query(ThreadDB).count() == 0 and db.query(PostDB).count() == 0:
        for post_data in INITIAL_POSTS:
            # Create a thread for each initial post
            thread = ThreadDB(
                title=(
                    post_data["text"][:50] + "..."
                    if len(post_data["text"]) > 50
                    else post_data["text"]
                ),
                creator="system",
            )
            db.add(thread)
            db.flush()  # To get the thread ID

            # Create the post within the thread
            db_post = PostDB(thread_id=thread.id, is_initial_post=True, **post_data)
            db.add(db_post)

    if False:
        # Get the first thread id from the newly created threads
        thread_id = db.query(ThreadDB).first().id

        # Seed documents (keep existing code)
        for doc_id, doc_data in INITIAL_DOCUMENTS.items():
            if not db.query(DocumentDB).filter(DocumentDB.id == doc_id).first():
                db_doc = DocumentDB(
                    id=doc_id,
                    thread_id=thread_id,
                    title=doc_data["title"],
                    content=doc_data["content"],
                    type=doc_data["type"],
                )
                db.add(db_doc)

    db.commit()
    db.close()


# Dependency for database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# FastAPI app
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount the uploads directory
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/threads", response_model=List[Thread])
async def get_threads(db: Session = Depends(get_db)):
    return db.query(ThreadDB).order_by(ThreadDB.last_activity.desc()).all()


@app.get("/api/threads/{thread_id}", response_model=CompleteThread)
async def get_thread(thread_id: int, db: Session = Depends(get_db)):
    thread = db.query(ThreadDB).filter(ThreadDB.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.view_count += 1
    db.commit()
    return thread


@app.post("/api/threads", response_model=Thread)
async def create_thread(
    title: str = Form(...),
    creator: str = Form(...),
    initial_post: str = Form(...),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    # Handle image upload if provided
    image_path = None
    if image:
        try:
            file_extension = Path(image.filename).suffix
            unique_filename = f"{uuid4()}{file_extension}"
            file_path = UPLOAD_DIR / unique_filename
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_path = f"/uploads/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Create thread
    db_thread = ThreadDB(title=title, creator=creator)
    db.add(db_thread)
    db.flush()  # To get the thread ID

    # Create initial post
    db_post = PostDB(
        thread_id=db_thread.id,
        author=creator,
        text=initial_post,
        image=image_path,
        is_initial_post=True,
    )
    db.add(db_post)

    db.commit()
    db.refresh(db_thread)
    return db_thread


# delete thread
@app.delete("/api/threads/{thread_id}")
async def delete_thread(thread_id: int, db: Session = Depends(get_db)):
    thread = db.query(ThreadDB).filter(ThreadDB.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    db.delete(thread)
    db.commit()
    return {"message": "Thread deleted"}


@app.post("/api/threads/{thread_id}/posts", response_model=Post)
async def create_post(
    thread_id: int,
    text: str = Form(...),
    image: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    print("thread_id", thread_id)
    print("text", text)
    # Verify thread exists
    thread = db.query(ThreadDB).filter(ThreadDB.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Handle image upload
    image_path = None
    if image:
        try:
            file_extension = Path(image.filename).suffix
            unique_filename = f"{uuid4()}{file_extension}"
            file_path = UPLOAD_DIR / unique_filename
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_path = f"/uploads/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Create post
    db_post = PostDB(thread_id=thread_id, author="user", text=text, image=image_path)
    db.add(db_post)

    # Update thread
    thread.reply_count += 1
    thread.last_activity = datetime.utcnow()

    db.commit()
    db.refresh(db_post)
    return db_post


# json create post
@app.post("/api/system/threads/{thread_id}/posts", response_model=Post)
async def create_post_json(
    thread_id: int, post: PostCreate, db: Session = Depends(get_db)
):
    # Verify thread exists
    thread = db.query(ThreadDB).filter(ThreadDB.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Create post
    db_post = PostDB(thread_id=thread_id, author="system", **post.dict())
    db.add(db_post)

    # Update thread
    thread.reply_count += 1
    thread.last_activity = datetime.utcnow()

    db.commit()
    db.refresh(db_post)
    return db_post


@app.get("/api/threads/{thread_id}/posts", response_model=Post)
async def get_posts(thread_id: int, db: Session = Depends(get_db)):
    return (
        db.query(PostDB)
        .filter(PostDB.thread_id == thread_id)
        .order_by(PostDB.time)
        .all()
    )


@app.get("/api/threads/{thread_id}/documents", response_model=Dict[str, Document])
async def get_documents(thread_id: int, db: Session = Depends(get_db)):
    print("get_documents thread_id", thread_id)
    documents = db.query(DocumentDB).filter(DocumentDB.thread_id == thread_id).all()
    return {doc.id: doc for doc in documents}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename

        # Save the file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Return the relative path
        return {"filename": f"/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Document endpoints
@app.post("/api/documents", response_model=Document)
async def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    db_document = DocumentDB(id=str(uuid4()), **document.dict())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


@app.get("/api/documents/{doc_id}", response_model=Document)
async def get_document(doc_id: str, db: Session = Depends(get_db)):
    document = db.query(DocumentDB).filter(DocumentDB.id == doc_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Update view count and last viewed
    document.view_count += 1
    document.last_viewed = datetime.utcnow()
    db.commit()

    return document


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    document = db.query(DocumentDB).filter(DocumentDB.id == doc_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(document)
    db.commit()
    return {"message": "Document deleted"}


@app.put("/api/documents/{doc_id}", response_model=Document)
async def update_document(
    doc_id: str, document: DocumentCreate, db: Session = Depends(get_db)
):
    db_document = db.query(DocumentDB).filter(DocumentDB.id == doc_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")

    for key, value in document.dict().items():
        setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)
    return db_document


@app.get("/api/posts/{post_id}", response_model=Post)
async def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(PostDB).filter(PostDB.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Update view count, seen status, and last viewed
    post.view_count += 1
    post.seen = True
    post.last_viewed = datetime.utcnow()
    db.commit()

    return post


@app.put("/api/posts/{post_id}", response_model=Post)
async def update_post(
    post_id: int, post_update: PostCreate, db: Session = Depends(get_db)
):
    post = db.query(PostDB).filter(PostDB.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    for key, value in post_update.dict().items():
        setattr(post, key, value)
    post.edited = True

    db.commit()
    db.refresh(post)
    return post


@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(PostDB).filter(PostDB.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    db.delete(post)
    db.commit()
    return {"message": "Post deleted"}


@app.on_event("startup")
async def startup_event():
    init_db()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
