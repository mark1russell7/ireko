/** The text of each page in one file, for language models (https://llmstxt.org). */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { llmsFullTxt } from "../lib/llms.ts";

export const prerender = true;

export const GET: APIRoute = async () => new Response(llmsFullTxt(await getCollection("docs")), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
