export type ShellStyles = 
{
    outer   : React.CSSProperties;
    bar     : React.CSSProperties;
    left    : React.CSSProperties;
    right   : React.CSSProperties;
    title   : React.CSSProperties;
    rf      : React.CSSProperties;
};

export const Shell : ShellStyles = 
{
    outer   :   { 
                    position    : "relative", 
                    width       : "100vw", 
                    height      : "100vh", 
                    overflow    : "hidden" 
                },
    bar     :   {
                    position        : "absolute", 
                    left            : 0, 
                    top             : 0, 
                    width           : "100%", 
                    height          : 72,
                    background      : "#242424", 
                    borderBottom    : "1px solid #d0d7de", 
                    zIndex          : 1000, 
                    padding         : 8, 
                    boxSizing       : "border-box"
    },
    left    :   {
                    position    : "absolute", 
                    left        : 0, 
                    top         : 72, 
                    bottom      : 0, 
                    width       : "50%", 
                    borderRight : "1px solid #e5e7eb",
                    boxSizing   : "border-box"
                },
    right   :   {
                    position    : "absolute", 
                    left        : "50%", 
                    right       : 0, 
                    top         : 72, 
                    bottom      : 0, 
                    overflow    : "auto", 
                    boxSizing   : "border-box"
                },
    title   :   { 
                    position    : "absolute", 
                    left        : 8, 
                    top         : 8, 
                    fontSize    : 11, 
                    color       : "#64748b", 
                    zIndex      : 1 
                },
    rf      :   { 
                    position    : "absolute", 
                    left        : 0, 
                    right       : 0, 
                    top         : 0, 
                    bottom      : 0 
                },
};
