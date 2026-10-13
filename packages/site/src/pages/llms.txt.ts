/** The list of the pages for language models (https://llmstxt.org). */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { llmsTxt } from "../lib/llms.ts";

export const prerender = true;

export const GET: APIRoute = async () => new Response(llmsTxt(await getCollection("docs")), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
