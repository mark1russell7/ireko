export enum RuntimeEnv  
{ 
    Browser     = "browser", 
    Headless    = "headless" 
}
export enum Framework   
{ 
    React   = "react", 
    Vanilla = "vanilla", 
    Node    = "node" 
}
export enum Target      
{ 
    API         = "api", 
    Canvas      = "canvas", 
    DOM         = "dom", 
    ReactFlow   = "reactflow", 
    ThreeJS     = "threejs" 
}

// Placeholder types for threejs/r3f, implement later.
export type ThreeJsAdapter = unknown;

export type AdapterConfig = 
{
    runtime     : RuntimeEnv;
    framework   : Framework;
    target      : Target;
};

/**
 * Factory notes:
 * - API → just expose your computeLayout function (works everywhere).
 * - Canvas → React wrapper or vanilla mount depending on framework.
 * - DOM → React wrapper or vanilla mount depending on framework.
 * - ReactFlow → React only.
 * - ThreeJS → placeholders for now.
 */
