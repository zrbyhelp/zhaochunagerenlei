import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { runAiAction } from "./model";
import type { AiActionRequest, AiActionResponse } from "./schemas";

const AiActionState = Annotation.Root({
  request: Annotation<AiActionRequest>,
  response: Annotation<AiActionResponse | undefined>,
});

const aiActionGraph = new StateGraph(AiActionState)
  .addNode("call_model", async (state) => ({
    response: await runAiAction(state.request),
  }))
  .addEdge(START, "call_model")
  .addEdge("call_model", END)
  .compile();

export async function runAiActionWorkflow(request: AiActionRequest) {
  const result = await aiActionGraph.invoke({ request });

  if (!result.response) {
    throw new Error("AI_WORKFLOW_EMPTY_RESPONSE");
  }

  return result.response;
}
