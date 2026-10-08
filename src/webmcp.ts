import { useStore } from './store';
import { metrics } from './domain';
type ModelContext = { registerTool: (tool: { name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown }, options:{signal:AbortSignal}) => unknown };
export function registerOperationsTool(){
  const context=(document as Document & {modelContext?:ModelContext}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  try{Promise.resolve(context.registerTool({name:'get_fecra_operations_summary',title:'FECRA operasyon özetini oku',description:'Bu tarayıcıdaki demo operasyon verilerinin güncel satış, stok, onay ve görev sayaçlarını döndürür. Veriyi değiştirmez.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Boş bir nesne gönderin.');return {demo:true,role:useStore.getState().role,...metrics(useStore.getState())};}},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Desteklenmeyen tarayıcıda UI normal çalışır. */}
  return ()=>lifecycle.abort();
}
