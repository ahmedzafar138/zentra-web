from functools import lru_cache
from typing import List, Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_pinecone import PineconeVectorStore

from src.embed import get_embeddings
from src.memory import Message, get_memory
from src.utils import OPENAI_API_KEY, PINECONE_INDEX_NAME


# Cap each retrieved doc so two of them can never blow up the prompt.
MAX_DOC_CHARS = 600


@lru_cache(maxsize=1)
def _get_components():
    """Build the retriever + LLM + prompt once and reuse on every call.

    Cached because each of these does I/O or model warmup on first use.
    """
    embeddings = get_embeddings()
    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings,
    )
    # k=2 keeps the retrieved context small. Each doc is also truncated below.
    retriever = vectorstore.as_retriever(search_kwargs={"k": 2})
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=OPENAI_API_KEY,
        temperature=0.2,
        max_tokens=160,
    )
    prompt = ChatPromptTemplate.from_template(
        """
You are a fitness expert.

Answer the question in a precise and concise way.

Rules:
- Keep the answer under 3-4 sentences
- Do NOT add extra explanations
- Do NOT repeat the question
- Do NOT mention "context", "information", or the conversation history
- Give only the direct answer
- Use the conversation history to resolve pronouns and follow-ups when needed
- If the answer is not found, say: "I don't know based on the available information."

Conversation history (most recent last):
{history}

Question:
{question}

Information:
{context}
        """.strip()
    )
    return retriever, llm, prompt


def _format_docs(docs) -> str:
    parts = []
    for doc in docs:
        text = doc.page_content[:MAX_DOC_CHARS].strip()
        if text:
            parts.append(text)
    return "\n\n".join(parts) if parts else "(no relevant information found)"


def _format_history(messages: List[Message]) -> str:
    if not messages:
        return "(no prior conversation)"
    lines = []
    for msg in messages:
        role = "User" if msg.get("role") == "user" else "Assistant"
        content = (msg.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines) if lines else "(no prior conversation)"


def ask_question(question: str, conversation_id: Optional[str] = None) -> str:
    """Answer the question, using prior turns as context when available.

    `conversation_id` is the caller's stable handle. Passing the same id on
    successive calls gives the user a multi-turn experience; rotating it (or
    not passing one) starts fresh.
    """
    retriever, llm, prompt = _get_components()
    memory = get_memory()

    history = memory.get(conversation_id) if conversation_id else []

    docs = retriever.invoke(question)
    context = _format_docs(docs)
    history_text = _format_history(history)

    messages = prompt.format_messages(
        question=question,
        context=context,
        history=history_text,
    )
    response = llm.invoke(messages)
    answer = response.content if hasattr(response, "content") else str(response)
    answer = answer.strip()

    if conversation_id:
        memory.append(conversation_id, "user", question)
        memory.append(conversation_id, "assistant", answer)

    return answer
