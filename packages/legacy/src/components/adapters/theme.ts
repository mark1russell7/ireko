export type Theme = 
{
    node    :   {
                    bg          : string;
                    border      : string;
                    radius      : number;
                    fontSize    : number;
                    text        : string;
                };
    wire    :   {
                    stroke  : string;
                    width   : number;
                };
    canvas  :   {
                    bg  : string;
                };
};

export const defaultTheme : Theme = {
                                        node    :   {
                                                        bg          : "#ffffff",
                                                        border      : "#cbd5e1",
                                                        radius      : 10,
                                                        fontSize    : 12,
                                                        text        : "#0f172a",
                                                    },
                                        wire    :   {
                                                        stroke  : "#94a3b8",
                                                        width   :   1,
                                                    },
                                        canvas  :   {
                                                        bg  : "#ffffff",
                                                    },
                                    };
