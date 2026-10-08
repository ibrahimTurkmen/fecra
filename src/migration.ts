import { addFecraValidationExamples } from './domain';
import type { Data } from './domain';

// v1 dosya denemelerinin bağlı kayıtlarını birlikte temizle; ticari verileri koru.
export function migrateDemoData(previous: Data): Data {
  const s = structuredClone(previous);
  const oldFiles = new Set<string>();
  const collect = (name: string) => { if (!/^fecra[-_]/i.test(name)) oldFiles.add(name); };
  s.imports.forEach(i => collect(i.name));
  s.tasks.filter(t => t.source.startsWith('import:')).forEach(t => collect(t.source.slice(7)));
  [...s.events.map(e => e.detail), ...s.notifications.map(n => n.title)].forEach(text => {
    const name = text.match(/^(.+?\.(?:xlsx|csv))(?=\s*[:·])/i)?.[1]; if (name) collect(name.trim());
  });
  const foreignTaskIds = s.tasks.filter(t => oldFiles.has(t.source.slice(7))).map(t => t.id);
  const obsolete = (text: string) => [...oldFiles, ...foreignTaskIds].some(value => text.includes(value));
  s.tasks = s.tasks.filter(t => !obsolete(t.title) && !obsolete(t.source));
  s.events = s.events.filter(e => !obsolete(e.title) && !obsolete(e.detail));
  s.notifications = s.notifications.filter(n => !obsolete(n.title));
  s.imports = s.imports.filter(i => !oldFiles.has(i.name)).map(i => ({ ...i, status: i.status ?? (i.errors ? 'Kontrol Gerekli' : 'Tamamlandı') }));
  s.tasks.filter(t => t.source.startsWith('import:')).forEach(t => {
    const name = t.source.slice(7);
    if (!s.imports.some(i => i.name === name)) s.imports.unshift({ id: `IMP-${++s.sequence}`, name, added: 0, updated: 0, errors: Number(t.title.match(/(\d+) hatalı/)?.[1] ?? 1), status: 'Kontrol Gerekli', at: t.createdAt });
  });
  s.requests.filter(r => r.status === 'Onay Bekliyor').forEach(r => {
    if (!s.tasks.some(t => t.source === `price:${r.id}`)) s.tasks.unshift({ id: `TSK-${++s.sequence}`, title: `${r.id} · ${r.productName} fiyat talebini değerlendir`, source: `price:${r.id}`, team: 'Yönetici', priority: 'Normal', status: 'Bekliyor', createdAt: r.createdAt });
  });
  addFecraValidationExamples(s);
  return s;
}
