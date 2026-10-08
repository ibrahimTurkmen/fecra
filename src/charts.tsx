import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { salesOrders, orderTotal, channels, money, salesTrend } from './domain';
import { useStore } from './store';
export function SalesChart({ days = 7 }: {days?:number}) {
  const s = useStore();
  const points = salesTrend(s, days);
  return <div className="chart" aria-label="Son günlerin satış ve katkı grafiği"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{top:10,right:12,left:-16,bottom:0}}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a3c50" stopOpacity={0.15}/><stop offset="100%" stopColor="#8a3c50" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#ececf0" strokeDasharray="3 4"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#85858d',fontSize:13}} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#85858d',fontSize:13}} tickFormatter={v => `${Number(v / 1000).toLocaleString('tr-TR')}b`}/><Tooltip formatter={v => money(Number(v))} contentStyle={{border:'1px solid #e8e5e7',borderRadius:10,fontSize:13}}/><Area name="Satış" type="monotone" dataKey="Satış" stroke="#7c3046" strokeWidth={2.5} fill="url(#salesFill)"/><Area name="Katkı" type="monotone" dataKey="Katkı" stroke="#c3a062" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer></div>;
}
export function ChannelChart() {
  const s = useStore(); const data = channels.map(name => ({name, total:salesOrders(s).filter(o => o.channel === name).reduce((n,o) => n + orderTotal(o),0)}));
  return <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:15,left:-5,right:15,bottom:0}}><CartesianGrid vertical={false} stroke="#eee"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:13}}/><YAxis axisLine={false} tickLine={false} tickFormatter={v => `${Number(v / 1000).toLocaleString('tr-TR')}b`} tick={{fontSize:13}}/><Tooltip formatter={v => money(Number(v))}/><Bar dataKey="total" name="Satış" radius={[5,5,0,0]} maxBarSize={62}>{data.map((d,i) => <Cell key={d.name} fill={['#7c3046','#b69355','#c9c2cc'][i]}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}
