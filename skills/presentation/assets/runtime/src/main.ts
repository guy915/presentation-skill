import "./runtime/runtime.css";
import "./theme.css"; // the talk's faces and tokens, after the runtime's CSS so they win
import { start } from "./runtime/deck.ts";
import { beats, talk } from "./beats.ts";
import { sections } from "./sections/index.ts";

start(beats, sections, talk);
