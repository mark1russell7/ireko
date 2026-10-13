import { 
  JSX, 
  useMemo 
} from "react";
import { 
  Segmented, 
  Select, 
  SelectOption
} from "./controls";
import { NodeConfig } from "../../graph/types";
import { 
    EdgeLineType,
  LayoutChildrenMode, 
  LayoutTypes 
} from "../../layout/layout.enum";

type Scope = "all" | string;


export type CollectReturn = 
{
  ids   : string[];
  byId  : Record<string, NodeConfig>;
}
const collect = (
                    root : NodeConfig
                ) : CollectReturn => 
{
    const ids   : string[] = [];
    const byId  : Record<string, NodeConfig> = {};
    const walk  =   (
                        n : NodeConfig
                    ) : void => 
                        {
                            ids.push(n.id); 
                            byId[n.id] = n;
                            (n.children ?? [])
                                .forEach(walk);
                        }
    walk(root);
    return  { 
                ids, 
                byId 
            };
}
const subtreeIds =  (
                        byId    : Record<string, NodeConfig>, 
                        start   : string
                    ) : string[] => 
{
    const res : string[] = [];
    const walk =    (
                        n : NodeConfig
                    ) : void => 
                        {
                            res.push(n.id);
                            (n.children ?? [])
                                .forEach(walk);
                        }
    walk(byId[start]);
    return res;
}
export type ConfiguratorProps = 
{
    root                : NodeConfig;
    modes               : Record<string, LayoutChildrenMode>;
    setModes            : (f: (prev: Record<string, LayoutChildrenMode>) => Record<string, LayoutChildrenMode>) => void;
    layout              : LayoutTypes;
    setLayout           : (l: LayoutTypes) => void;
    scope               : Scope;
    setScope            : (s: Scope) => void;
    applyToSubtree      : boolean;
    setApplyToSubtree   : (v: boolean) => void;
    routerName          : EdgeLineType;
    setRouterName       : (r: EdgeLineType) => void;
}
                        
export const Configurator = (
                                {
                                    root, 
                                    modes, 
                                    setModes, 
                                    layout, 
                                    setLayout, 
                                    scope, 
                                    setScope,
                                    applyToSubtree, 
                                    setApplyToSubtree,
                                    routerName,
                                    setRouterName
                                } : ConfiguratorProps
                            ) : JSX.Element => 
{
    const { ids, byId } : CollectReturn = useMemo(() => collect(root), [root]);

    const targetIds = useMemo   (
                                    () => 
                                    {
                                        if (scope === "all") 
                                        {
                                            return ids;
                                        }
                                        return applyToSubtree 
                                                ? subtreeIds(byId, scope) 
                                                : [scope];
                                    }, 
                                    [
                                        ids, 
                                        byId, 
                                        scope, 
                                        applyToSubtree
                                    ]
                                );

    const modeOptions   :   { label : string  ; value : LayoutChildrenMode        }[] = 
                        [
                            { label : "Graph" , value : LayoutChildrenMode.GRAPH  },
                            { label : "Nested", value : LayoutChildrenMode.NESTED },
                        ];
    const layoutOptions :   { label : string  ; value : LayoutTypes               }[] = 
                        [
                            { label : "Grid"  , value : LayoutTypes.Grid          },
                            { label : "Radial", value : LayoutTypes.Radial        },    
                        ];

    const currentModes  : LayoutChildrenMode[]              = targetIds
                                                                .map(
                                                                        (
                                                                            id : string
                                                                        ) : LayoutChildrenMode => 
                                                                            modes[id] ?? LayoutChildrenMode.GRAPH
                                                                    );
    const allSame       : boolean                           = currentModes
                                                                .every  (
                                                                            (
                                                                                m : LayoutChildrenMode
                                                                            ) : boolean => 
                                                                                m === currentModes[0]
                                                                        );
    const activeMode    : LayoutChildrenMode | undefined    = allSame 
                                                                ? currentModes[0] 
                                                                : undefined;

    const OuterStyle : React.CSSProperties = 
    {
        display     : "inline-flex",
        gap         : 12,
        alignItems  : "center"
    };

    const CheckBoxStyle : React.CSSProperties =
    {
        fontSize: 12
    }

    const SelectOptions : SelectOption<string>[] =
    [
        {
            label: "All nodes",
            value: "all"
        },
        ...ids.map  (
                        (id : string) : SelectOption<string> => 
                            (
                                { 
                                    label   : id, 
                                    value   : id 
                                }
                            )
                    )
    ];
    const onSelectChange    =   (
                                    v : string
                                ) : void => 
                                    setScope(v as Scope);

    const onCheckBoxChange  =   (
                                    e : React.ChangeEvent<HTMLInputElement>
                                ) : void => 
                                    setApplyToSubtree(e.target.checked);

    const onLayoutChange    =   (
                                    v : string
                                ) : void => 
                                    setLayout(v as LayoutTypes);
    const onModeChange      =   (
                                    v : string | undefined
                                ) : void => 
                                    setModes(
                                                (
                                                    prev : Record<string, LayoutChildrenMode>
                                                ) : Record<string, LayoutChildrenMode> => 
                                                {
                                                    const next : Record<string, LayoutChildrenMode> =   { 
                                                                                                            ...prev 
                                                                                                        };
                                                    for (const id of targetIds) 
                                                    {
                                                        next[id] = v as LayoutChildrenMode;
                                                    }
                                                    return next;
                                                }
                                            );
    return (
        <div style = {OuterStyle}>
            <Select
                label       =   "Edit"
                value       =   {scope          }
                onChange    =   {onSelectChange }
                options     =   {SelectOptions  }
            />
            <label style = {CheckBoxStyle}>
                <input 
                    type        =   "checkbox" 
                    checked     =   {applyToSubtree     } 
                    onChange    =   {onCheckBoxChange   } 
                /> Apply to subtree
            </label>


            {/* Segmented control for mode */}
            <Segmented
                label       =   "Layout"
                value       =   {layout         }
                options     =   {layoutOptions  }
                onChange    =   {onLayoutChange }
            />
    
            <Segmented<string | undefined>
                label       =   "Mode"
                value       =   {allSame 
                                    ? activeMode
                                    : undefined }
                options     =   {modeOptions    }
                onChange    =   {onModeChange   }
            />
            <button
                style={{ fontSize: 12, padding: "6px 8px", marginLeft: 8 }}
                onClick={() => setModes((_) => Object.fromEntries(ids.map((id) => [id, LayoutChildrenMode.GRAPH])))}
            >
                All Graph
            </button>
            <button
                style={{ fontSize: 12, padding: "6px 8px", marginLeft: 6 }}
                onClick={() => setModes((_) => Object.fromEntries(ids.map((id) => [id, LayoutChildrenMode.NESTED])))}
            >
                All Nested
            </button>
            <Segmented<EdgeLineType>
                label="Router"
                value={routerName}
                options={[{ label: "Line", value: EdgeLineType.Straight }, { label: "Ortho", value: EdgeLineType.Ortho }]}
                onChange={setRouterName}
            />
        </div>
    );
}
