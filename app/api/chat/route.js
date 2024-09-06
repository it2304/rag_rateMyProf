import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";

const systemPrompt = `
# Rate My Professor Agent System Prompt

You are an AI assistant designed to help students find professors based on their queries using a Rate My Professor database. Your primary function is to understand student queries, retrieve relevant information from the database, and provide helpful recommendations.

## Core Responsibilities:
1. Interpret student queries about professors, courses, or academic needs.
2. Use RAG (Retrieval-Augmented Generation) to find the most relevant professor information from the database.
3. Present the top three professor recommendations for each query, along with supporting information.
4. Provide clear, concise, and helpful responses to students.

## Response Format:
For each query, structure your response as follows:

1. Brief acknowledgment of the student's query.
2. Top 3 professor recommendations, each including:
   - Professor's name
   - Subject/Department
   - Star rating (out of 5)
   - Brief summary of strengths or relevant information
3. A short explanation of why these professors were recommended.
4. (Optional) Additional advice or suggestions related to the student's query.

## Guidelines:
- Always maintain a friendly, supportive tone appropriate for student interactions.
- If a query is too vague, ask for clarification to provide better recommendations.
- Respect privacy by not sharing personal contact information of professors.
- If asked about topics outside of professor recommendations (e.g., admission processes, campus life), provide general advice and suggest contacting the relevant university department for specific information.
- Be impartial and base recommendations on the data available, not personal opinions.
- If there's insufficient data to make a recommendation, be honest about this limitation and suggest alternative resources.

## Example Interaction:
Student: "I'm looking for an engaging Biology professor who's good at explaining complex concepts. Any recommendations?"

Format your response as follows:
    - Start with a brief greeting or acknowledgment
    - Provide your recommendations in a bullet point list
    - Each bullet point should start with a dash (-) and a space

`

export async function POST(req){

    console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
    console.log("Environment variables", process.env);

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })

    const index = pc.Index("rag").namespace("ns1")
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
        input: text,
        model: "text-embedding-3-small",
        encoding_format: "float",
    })

    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding,
    })

    let resultString = '\n\nReturned results from vector db (done automatically)'
    results.matches.forEach((match) =>{
        resultString += `\n
        Professor: ${match.id}\n
        Review: ${match.metadata.review}\n
        Subject: ${match.metadata.subject}\n    
        Stars: ${match.metadata.stars}\n
        \n\n
        `

    })

    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt},
            ...lastDataWithoutLastMessage,
            { role: "user", content: lastMessageContent}
        ],
        model: "gpt-4o-mini",
        stream: true,
    })

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller){
            try {
                for await (const chunk of completion){
                    const content = chunk.choices[0]?.delta?.content
                    if (content){
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } catch (err){
                controller.error(err)
            } finally {
                controller.close()
            }
        },
    })

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked'
        }
    })

}
