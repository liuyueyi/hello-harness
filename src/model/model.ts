import type { ModelRequest, ModelResponse } from "./types";
import type { ModelEvent } from "../events";

export interface Model {
  readonly modelName: string;

  generate(request: ModelRequest): Promise<ModelResponse>;

  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}