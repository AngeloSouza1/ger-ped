'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';


type Customer = { id: string; name: string; email?: string | null; phone?: string | null };
type Product  = { id: string; name: string; unit?: string | null; price: number | string };
type CustPrice = { customerId: string; productId: string; price: number | string };

// +++ TIPOS NOVOS (adicione no topo do arquivo)
// Tipos para impressão/preview
type PrintItem = {
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

// type PrintOrder = {
//   id?: string;
//   number: number | string;
//   customer?: { id?: string; name?: string; email?: string | null; phone?: string | null } | null;
//   notes?: string;
//   items: PrintItem[];
//   total: number;
//   issuedAt?: string;
// };



type OrderItemAPI = {
  name?: string;
  unit?: string | null;
  quantity?: number;
  qty?: number;
  unitPrice?: number;
  price?: number;
  total?: number;
  product?: { name?: string; unit?: string | null; price?: number } | null;
};

type FlatItem = {
  name: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

type OrderPreview = {
  id?: string;
  number: number | string;
  customer: { id?: string; name?: string; email?: string | null; phone?: string | null } | null;
  notes?: string;
  items: FlatItem[];
  total: number;
  issuedAt: string;
};


type ItemRow = {
  productId: string;
  name: string;
  unit?: string | null;
  unitPrice: number;
  quantity: number;
  total: number;
};

type OrderRow = {
  id: string;
  number: number | string;
  customer?: { id?: string; name?: string; email?: string | null; phone?: string | null } | null;
  total: number;
  items?: OrderItemAPI[];
  createdAt?: string;
  notes?: string;
};

type ToastKind = 'success' | 'error' | 'info' | 'warning';
type ToastAction = { ariaLabel: string; title?: string; onClick: () => void; svgPath: string };
type Toast = {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number; // 0 = persistente
  actions?: ToastAction[];
};

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [custPrices, setCustPrices] = useState<CustPrice[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [saved, setSaved] = useState<OrderPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const getJson = useCallback(async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
    const r = await fetch(url, { signal, credentials: 'include', cache: 'no-store' });
    if (r.status === 401) {
      router.replace('/login?callbackUrl=' + encodeURIComponent(location.pathname + location.search));
      throw new Error('unauthorized');
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()) as T;
  }, [router]);
  
  
  

  const logout = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    try {
      await fetch('/api/logout', { method: 'POST', cache: 'no-store', credentials: 'include' });
    } finally {
      const next = '/login?callbackUrl=' + encodeURIComponent(location.pathname + location.search);
      try { router.replace(next); } catch {}
      location.assign(next);
    }
  };
  
  
  



  // ====== TOASTS ======
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToast = useRef({ msg: '', ts: 0 });
  const maxToasts = 4;

  function baseDuration(kind: ToastKind) {
    switch (kind) {
      case 'success': return 1000;
      case 'info':    return 1200;
      case 'warning': return 2000;
      case 'error':   return 2500;
    }
  }
  function iconFor(kind: ToastKind) {
    if (kind === 'success') return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14-4-4 1.414-1.414L11 12.172l4.586-4.586L17 9l-6 7z';
    if (kind === 'error')   return 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v7h-2V7zm0 9h2v2h-2v-2z';
    if (kind === 'warning') return 'M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-6h-2v5h2v-5z';
    return 'M11 7h2v2h-2V7zm0 4h2v6h-2v-6zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z';
  }

  function pushToast(
    kind: ToastKind,
    message: string,
    opts?: Partial<Omit<Toast, 'id'|'kind'|'message'|'duration'>> & { duration?: number }
  ) {
    const now = Date.now();
    // dedupe simples (mesma mensagem em 1.2s)
    if (lastToast.current.msg === message && now - lastToast.current.ts < 1200) return;
    lastToast.current = { msg: message, ts: now };

    const id = now + Math.random();
    const duration = opts?.duration ?? baseDuration(kind);
    const t: Toast = { id, kind, title: opts?.title, message, duration: duration!, actions: opts?.actions };

    setToasts(prev => [...prev, t].slice(-maxToasts));

    if (duration && duration > 0) {
      const timer = setTimeout(() => dismissToast(id), duration);
      // pausa o auto-close ao passar o mouse (não retoma automaticamente)
      queueMicrotask(() => {
        const el = document.querySelector(`[data-toast-id="${id}"]`);
        el?.addEventListener('mouseenter', () => clearTimeout(timer), { once: true });
      });
    }
  }
  function dismissToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function normalizePhoneBR(raw?: string | null): string {
    if (!raw) return '';
    let d = String(raw).replace(/\D/g, '');
    if (d.startsWith('0')) d = d.replace(/^0+/, '');
    if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
    return d.replace(/^\+/, '');
  }
  

  type ItemSummary = { name: string; quantity: number };

function normalizeItems(o: OrderPreview | OrderRow): ItemSummary[] {
  // Em OrderPreview os itens já são FlatItem; em OrderRow podem ser OrderItemAPI
  const list = (o.items ?? []) as Array<FlatItem | OrderItemAPI>;
  return list.map((it) => {
    const name =
      ('name' in it && it.name)
        ? it.name
        : (('product' in it && it.product?.name) ? it.product.name! : 'Item');

    const quantity =
      ('quantity' in it && typeof it.quantity === 'number')
        ? it.quantity
        : (('qty' in it && typeof it.qty === 'number') ? it.qty! : 0);

    return { name, quantity };
  });
}

  function buildWhatsAppSummary(o: OrderPreview | OrderRow, maxItems = 3): string {
    const cliente = o.customer?.name ? ` — ${o.customer.name}` : '';
    const header  = `Pedido #${o.number ?? '—'}${cliente}`;
  
    const itens   = normalizeItems(o);
    const vis     = itens.slice(0, maxItems).map((it) => `${it.name} x ${it.quantity}`);
    const extras  = itens.length > maxItems ? ` … +${itens.length - maxItems} itens` : '';
    const linhaItens = itens.length ? `Itens (${itens.length}): ${vis.join(', ')}${extras}` : 'Itens: —';
  
    const total   = `Total: ${brl.format(Number(o.total || 0))}`;
    const obs     = o.notes ? `Obs: ${o.notes}` : null;
  
    return [header, linhaItens, total, obs].filter(Boolean).join('\n');
  }


  // Confirmação (toast persistente com botões ícone-only)
  const [confirmState, setConfirmState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);
  function askConfirm(message: string) {
    return new Promise<boolean>((resolve) => setConfirmState({ message, resolve }));
  }
  function confirmYes() { confirmState?.resolve(true); setConfirmState(null); }
  function confirmNo()  { confirmState?.resolve(false); setConfirmState(null); }

  // Remover badge/ícone do Dev Overlay em dev
  useEffect(() => {
    // se estiver depurando, pode inverter a condição para NÃO rodar em dev
    if (process.env.NODE_ENV !== 'development') return;
  
    const selectors = [
      '[data-nextjs-devtools-overlay]',
      '[data-nextjs-react-dev-overlay-badge]',
      '[data-next-dev-overlay]',
      'button[aria-label*="developer" i]',
      'button[aria-label*="devtools" i]',
      'button[aria-label*="next" i]',
    ].join(',');
  
    const removeBadge = () => {
      try {
        document.querySelectorAll(selectors).forEach(el => el.remove());
      } catch {
        // ignora qualquer erro de seletor
      }
    };
  
    removeBadge();
    const obs = new MutationObserver(removeBadge);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  
  

  // Tema claro/escuro
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const saved = (() => { try { return localStorage.getItem('theme') as 'light'|'dark'|null; } catch { return null; }})();
         const cur =
           saved ??
           (document.documentElement.getAttribute('data-theme') as 'light'|'dark'|null) ??
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(cur);
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch {}
    }
  }

  // Boot
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      let unauthorized = false;
      try {
        const [c, p, cp] = await Promise.all([
          getJson<Customer[]>('/api/customers', ac.signal),
          getJson<Product[]>('/api/products', ac.signal),
          getJson<CustPrice[]>('/api/customer-prices', ac.signal),
        ]);
        setCustomers(c);
        setProducts(p);
        setCustPrices(cp.map(r => ({
          customerId: r.customerId,
          productId : r.productId,
          price     : Number(r.price),
        })));
      } catch (err) {
        if (err instanceof Error && err.message === 'unauthorized') {
          unauthorized = true; // vamos deixar o redirect cuidar
        } else {
          setError('Falha ao carregar dados das APIs');
        }
      } finally {
        if (!unauthorized) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [getJson]);
  
  

  const selectedCustomer = customers.find(c => c.id === customerId) || null;

  function findUnitPrice(cid: string, pid: string) {
    const special = custPrices.find(x => x.customerId === cid && x.productId === pid)?.price;
    if (special != null) return Number(special);
    const prod = products.find(p => p.id === pid);
    return prod ? Number(prod.price) : 0;
  }

  async function clearAllItems() {
    if (items.length === 0) return;
    const ok = await askConfirm('Remover TODOS os itens da tabela?');
    if (!ok) return;
    const snapshot = [...items];
    setItems([]);
    pushToast('success', 'Itens removidos.', {
      actions: [{
        ariaLabel: 'Desfazer',
        title: 'Desfazer',
        onClick: () => setItems(snapshot),
        svgPath: 'M12 5v3l4-4-4-4v3C7.58 3 4 6.58 4 11c0 1.57.46 3.03 1.24 4.26l1.49-1.49A6 6 0 0 1 12 5zm6.76 1.74L17.27 8.2A6 6 0 0 1 12 19v3l-4-4 4-4v3a6 6 0 0 0 6.76-10.26z'
      }]
    });
  }

  function addItem() {
    if (!products.length) {
      pushToast('info', 'Cadastre um produto para adicionar itens.', { title: 'Sem produtos' });
      return;
    }
    const first = products[0];
    const up = customerId ? findUnitPrice(customerId, first.id) : Number(first.price);
    setItems(prev => [
      ...prev,
      {
        productId: first.id,
        name     : first.name,
        unit     : first.unit ?? undefined,
        unitPrice: up,
        quantity : 1,
        total    : Number((1 * up).toFixed(2)),
      },
    ]);
    pushToast('success', 'Item adicionado.', { title: 'Itens' });
  }
  function removeItem(idx: number) {
    setItems(prev => {
      const arr = [...prev];
      const removed = arr[idx];
      const next = arr.filter((_, i) => i !== idx);
      pushToast('info', 'Item removido.', {
        title: 'Itens',
        actions: [{
          ariaLabel: 'Desfazer',
          title: 'Desfazer',
          onClick: () => setItems(s => {
            const copy = [...s];
            copy.splice(idx, 0, removed);
            return copy;
          }),
          svgPath: 'M12 5v3l4-4-4-4v3C7.58 3 4 6.58 4 11c0 1.57.46 3.03 1.24 4.26l1.49-1.49A6 6 0 0 1 12 5zm6.76 1.74L17.27 8.2A6 6 0 0 1 12 19v3l-4-4 4-4v3a6 6 0 0 0 6.76-10.26z'
        }]
      });
      return next;
    });
  }
  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems(prev => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      merged.unitPrice = Number(merged.unitPrice ?? 0);
      merged.quantity  = Math.max(0, Number(merged.quantity ?? 0));
      merged.total     = Number((merged.unitPrice * merged.quantity).toFixed(2));
      next[idx] = merged;
      return next;
    });
  }
  function onChangeProduct(idx: number, productId: string) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const up = customerId ? findUnitPrice(customerId, productId) : Number(prod.price);
    updateItem(idx, { productId, name: prod.name, unit: prod.unit ?? undefined, unitPrice: up });
  }
  useEffect(() => {
    if (!customerId) return;
    setItems(prev =>
      prev.map(it => {
        const up = findUnitPrice(customerId, it.productId);
        return { ...it, unitPrice: up, total: Number((up * it.quantity).toFixed(2)) };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.total || 0), 0),
    [items],
  );

  // Validação: liberar impressão/PDF
  const allItemsValid =
    items.length > 0 &&
    items.every(it => it.productId && Number(it.quantity) > 0 && Number(it.unitPrice) > 0);
  const canPrint = Boolean(customerId) && allItemsValid;

  // reset após salvar
  function resetForm() {
    setCustomerId('');
    setNotes('');
    setItems([]);
  }

  async function saveOrder() {
    if (!customerId) { pushToast('warning', 'Selecione um cliente.', { title: 'Validação' }); return; }
    if (items.length === 0) { pushToast('warning', 'Adicione pelo menos 1 item.', { title: 'Validação' }); return; }
  
    const payload = { customerId, notes, items };
    const res = await fetch('/api/orders', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
    });
  
    const json = await res.json().catch(() => ({})) as Partial<OrderRow>;
  
    if (!res.ok) {
      pushToast('error', (json as { error?: string })?.error || 'Falha ao salvar pedido.', { title: 'Erro' });
      return;
    }
  
    const flat = flattenOrderForPreview(json as OrderRow);
    setSaved(flat);
    pushToast('success', `Pedido #${flat.number} salvo!`, { title: 'Sucesso' });
    resetForm();
  }
  

  function printPage() { window.print(); }



  // function buildEmailParts(o: OrderPreview | OrderRow): { to: string; subject: string; body: string; mailto: string } {
  //   const body    = buildWhatsAppSummary(o, 8);
  //   const subject = `Pedido #${o.number ?? '—'} — ${o.customer?.name ?? ''}`;
  //   const to      = o.customer?.email || '';
  //   const mailto  = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  //   return { to, subject, body, mailto };
  // }




  const emitido = new Date().toLocaleString('pt-BR');

  // Preview achatado p/ impressão (usa "saved" se existir)
  const preview: OrderPreview = (() => {
    const base = saved ?? {
      number  : '—',
      customer: selectedCustomer
        ? { name: selectedCustomer.name, email: selectedCustomer.email, phone: selectedCustomer.phone }
        : null,
      notes,
      items   : items.map<FlatItem>(it => {
        const p = products.find(pp => pp.id === it.productId);
        return {
          name     : p?.name ?? it.name,
          unit     : (it.unit ?? p?.unit ?? null) ?? null,
          quantity : it.quantity,
          unitPrice: it.unitPrice,
          total    : it.total,
        };
      }),
      total,
      issuedAt: new Date().toLocaleString('pt-BR'),
    } as OrderPreview;
    return base;
  })();
  

 // ===== Impressão (2 vias na mesma folha sempre que couber) =====
const rows = preview.items?.length ?? 0;

// Limites por densidade (ajuste estes números se quiser)
const PRINT_LIMITS = { normal: 14, sm: 22, xs: 30 };

// Mantém as 2 vias na MESMA folha enquanto estiver dentro do limite "xs"
const needsTwoSheets = rows > PRINT_LIMITS.xs;

// Seleciona classe de densidade para caber mais linhas
const printDensityClass =
  rows <= PRINT_LIMITS.normal ? '' :
  rows <= PRINT_LIMITS.sm     ? 'print-scale-sm' :
  rows <= PRINT_LIMITS.xs     ? 'print-scale-xs' : '';


  // VIA de impressão
    function PrintSlip({
      o,
      copyLabel,
      minimal = false,
      onPrint,
    }: {
      o: OrderPreview;
      copyLabel: string;
      minimal?: boolean;
      onPrint?: (() => void) | null;
    }) {

    return (
      <div className="copy">
        <div className="copy-header">
          <Image
              src="/logo.svg"
              alt="Logo"
              width={112}   // 4x 28px, ajuste como preferir
              height={28}
              priority
              style={{ height: '28px', width: 'auto' }}
            />          
          <div>
            <div className="copy-title">Emissão de pedidos</div>
            <div className="copy-sub">Pedido #{o.number ?? '—'} • Emitido em {o.issuedAt}</div>
          </div>
             <div className="copy-badge">
                       {copyLabel}
                       {onPrint && (
                         <button
                           type="button"
                           className="copy-badge-btn screen-inline-only"
                           title="Imprimir"
                           aria-label="Imprimir"
                           onClick={onPrint}
                         >
                           <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                             <path d="M6 9V4h12v5h-2V6H8v3H6zm-2 2h16a2 2 0 0 1 2 2v5h-4v4H6v-4H2v-5a2 2 0 0 1 2-2zm4 11h8v-6H8v6z"/>
                           </svg>
                         </button>
                       )}
                     </div>
        </div>
        <div className="copy-grid">
          <div className="copy-field">
            <label>Cliente</label>
            <div>
              <div style={{ fontWeight: 700 }}>{o.customer?.name ?? '—'}</div>
              <div className="copy-contact">
                <span>{o.customer?.email ?? '—'}</span>
                <span>{o.customer?.phone ?? '—'}</span>
              </div>
            </div>
          </div>

          <div className="copy-field copy-field--full">
            <label>Observação</label>
            <div className="obs">{o.notes || '—'}</div>
          </div>
        </div>



        <table className="copy-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }} className="center">#</th>
              <th>Descrição</th>
              <th style={{ width: '10%' }} className="center">UN</th>
              <th style={{ width: minimal ? '16%' : '12%' }} className="num">Qtd</th>
              {!minimal && <th style={{ width: '14%' }} className="num">Preço</th>}
              <th style={{ width: minimal ? '22%' : '16%' }} className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {o.items.length === 0 ? (
              <tr>
                <td colSpan={minimal ? 5 : 6} style={{ textAlign: 'center', padding: '10mm 0' }}>— Sem itens —</td>
              </tr>
            ) : o.items.map((it: FlatItem, i: number) => (
              <tr key={i}>
                <td className="center">{i + 1}</td>
                <td className="desc">{it.name}</td>
                <td className="center">{it.unit ?? '-'}</td>
                <td className="num">{it.quantity}</td>
                {!minimal && <td className="num">{brl.format(Number(it.unitPrice || 0))}</td>}
                <td className="num">{brl.format(Number(it.total || 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={minimal ? 4 : 5} className="num">Total</th>
              <th className="num">{brl.format(Number(o.total || 0))}</th>
            </tr>
          </tfoot>
        </table>

        <div className="copy-footer">
          <div style={{ fontSize: '10px' }}>
            Documento gerado eletronicamente. Válido como pedido de compra.
          </div>
          <div className="sign-line"><span>Assinatura / Carimbo</span></div>
        </div>
      </div>
    );
  }

  // ===== MODAIS ===== (Clientes / Produtos / Pedidos) — sem alterações funcionais além dos toasts
  const [showClients, setShowClients] = useState(false);
  const [clientFilter, setClientFilter] = useState('');
  const filteredCustomers = useMemo(() => {
    const q = clientFilter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, clientFilter]);

  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [clientEditing, setClientEditing] = useState<Customer | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientSaving, setClientSaving] = useState(false);

  function openNewClient() {
    setClientEditing(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');   
    setClientFormOpen(true);
  }
  function openEditClient(c: Customer) {
    setClientEditing(c);
    setClientName(c.name || '');
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');   
    setClientFormOpen(true);
  }
  async function saveClient() {
    if (!clientName.trim()) {
      pushToast('warning', 'Informe o nome do cliente.', { title: 'Validação' });
      return;
    }
    try {
      setClientSaving(true);
      const payload = {
        name : clientName.trim(),
        email: clientEmail.trim() || null,
        phone: (clientPhone || '').trim() || null, // <<< AQUI ENTRA O PHONE
      };
  
      if (clientEditing) {
        const res = await fetch(`/api/customers/${clientEditing.id}`, {
          method : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Falha ao atualizar cliente');
        const updated = await res.json();
        setCustomers(prev => prev.map(c => (c.id === clientEditing.id ? updated : c)));
        if (customerId === clientEditing.id) setCustomerId(updated.id);
        pushToast('success', 'Cliente atualizado!', { title: 'Sucesso' });
      } else {
        const res = await fetch('/api/customers', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Falha ao criar cliente');
        const created = await res.json();
        setCustomers(prev => [created, ...prev]);
        pushToast('success', 'Cliente criado!', { title: 'Sucesso' });
      }
  
      setClientFormOpen(false);
    } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro ao salvar cliente.';
          pushToast('error', msg, { title: 'Erro' });
    } finally {
      setClientSaving(false);
    }
  }
  
  async function deleteClient(c: Customer) {
    const ok = await askConfirm(`Excluir cliente "${c.name}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir cliente');
      setCustomers(prev => prev.filter(x => x.id !== c.id));
      if (customerId === c.id) setCustomerId('');
      pushToast('success', 'Cliente excluído!', { title: 'Sucesso' });
    } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro ao excluir cliente.';
          pushToast('error', msg, { title: 'Erro' });
    }
  }

  const [showProducts, setShowProducts] = useState(false);
  const [productFilter, setProductFilter] = useState('');
  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.unit || '').toLowerCase().includes(q)
    );
  }, [products, productFilter]);

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productEditing, setProductEditing] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productUnit, setProductUnit] = useState('');
  const [productPrice, setProductPrice] = useState<string>('');
  const [productSaving, setProductSaving] = useState(false);

  function openNewProduct() {
    setProductEditing(null);
    setProductName('');
    setProductUnit('');
    setProductPrice('');
    setProductFormOpen(true);
  }
  function openEditProduct(p: Product) {
    setProductEditing(p);
    setProductName(p.name || '');
    setProductUnit(p.unit || '');
    setProductPrice(String(p.price ?? ''));
    setProductFormOpen(true);
  }
  async function saveProduct() {
    if (!productName.trim()) { pushToast('warning', 'Informe a descrição do produto.', { title: 'Validação' }); return; }
    const priceNum = Number(productPrice);
    if (Number.isNaN(priceNum) || priceNum < 0) { pushToast('warning', 'Preço inválido.', { title: 'Validação' }); return; }
    try {
      setProductSaving(true);
      if (productEditing) {
        const res = await fetch(`/api/products/${productEditing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: productName.trim(), unit: productUnit.trim() || null, price: priceNum }),
        });
        if (!res.ok) throw new Error('Falha ao atualizar produto');
        const updated = await res.json();
        setProducts(prev => prev.map(p => (p.id === productEditing.id ? updated : p)));
        pushToast('success', 'Produto atualizado!', { title: 'Sucesso' });
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: productName.trim(), unit: productUnit.trim() || null, price: priceNum }),
        });
        if (!res.ok) throw new Error('Falha ao criar produto');
        const created = await res.json();
        setProducts(prev => [created, ...prev]);
        pushToast('success', 'Produto criado!', { title: 'Sucesso' });
      }
      setProductFormOpen(false);
    }  catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao salvar produto.';
            pushToast('error', msg, { title: 'Erro' });
    } finally {
      setProductSaving(false);
    }
  }
  async function deleteProduct(p: Product) {
    const ok = await askConfirm(`Excluir produto "${p.name}"?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir produto');
      setProducts(prev => prev.filter(x => x.id !== p.id));
      setItems(prev => prev.filter(it => it.productId !== p.id));
      pushToast('success', 'Produto excluído!', { title: 'Sucesso' });
    } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro ao excluir produto.';
          pushToast('error', msg, { title: 'Erro' });
    }
  }

  // PEDIDOS
  const [orderPreview, setOrderPreview] = useState<OrderPreview | null>(null);
  const [showOrders, setShowOrders] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersFilter, setOrdersFilter] = useState('');
  const filteredOrders = useMemo(() => {
    const q = ordersFilter.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      String(o.number ?? '').toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q)
    );
  }, [orders, ordersFilter]);

  useEffect(() => {
    if (!showOrders) return;
    let ignore = false;
    (async () => {
      try {
        setOrdersLoading(true);
        setOrdersError(null);
        const data = await getJson<OrderRow[]>('/api/orders?limit=100');
        if (!ignore) setOrders(data || []);
      } catch {
        if (!ignore) setOrdersError('Falha ao carregar pedidos.');
      } finally {
        if (!ignore) setOrdersLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [showOrders, getJson]);
  


  async function sendOrderEmail(o: OrderRow) {
    try {
      const res = await fetch(`/api/orders/${o.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: o.customer?.email, order: o, attachPdf: true }),
      });
      if (res.ok) {
        pushToast('success', 'E-mail enviado com PDF!', { title: 'Pedidos' });
      } else {
        const j = await res.json().catch(() => ({}));
        pushToast('error', (j as { error?: string })?.error || 'Falha ao enviar e-mail.', { title: 'Pedidos' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao enviar e-mail.';
      pushToast('error', msg, { title: 'Pedidos' });
    }
  }
  
  async function downloadOrderPdf(o: OrderRow) {
    try {
      const res = await fetch(`/api/orders/${o.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: o }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
  
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedido-${o.number ?? o.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar/baixar o PDF.';
      pushToast('error', msg, { title: 'Pedidos' });
    }
  }
  
   // Converte OrderRow (API) para o formato do PrintSlip/preview
   function flattenOrderForPreview(o: OrderRow): OrderPreview {
    const items: FlatItem[] = (o.items ?? []).map((it: OrderItemAPI) => {
      const qty = Number(it.quantity ?? it.qty ?? 0);
      const unitPrice = Number(it.unitPrice ?? it.price ?? it.product?.price ?? 0);
      const total = Number(it.total ?? (qty * unitPrice));
      return {
        name     : it.name ?? it.product?.name ?? 'Item',
        unit     : (it.unit ?? it.product?.unit ?? null) ?? null,
        quantity : qty,
        unitPrice,
        total,
      };
    });
  
    const total =
      typeof o.total === 'number'
        ? o.total
        : items.reduce((s, it) => s + it.total, 0);
  
    return {
      id: o.id,
      number: o.number,
      customer: o.customer ?? null,
      notes: o.notes ?? '',
      items,
      total: Number(total),
      issuedAt: new Date().toLocaleString('pt-BR'),
    };
  }

  // function printSavedOrder(o: OrderRow) {
  //   const flat = flattenOrderForPreview(o);
  //   setSaved(flat);
  //   setTimeout(() => window.print(), 30);
  //   setTimeout(() => setSaved(null), 800);
  // }
  


  if (loading) return <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8 py-10">Carregando…</div>;
  if (error)   return <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8 py-10 text-red-600">{error}</div>;

  return (
    <>
      {/* ====== UI ====== */}
      <div className="screen-only">
        <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8 py-6 overflow-visible" style={{ overflow: 'visible' }}>
          <div className="grid gap-6 lg:grid-cols-12">
            {/* ESQUERDA */}
            <aside className="lg:col-span-4 space-y-3">
              <section className="card rounded-2xl border bg-white p-4 shadow-sm md:p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Emissão de pedidos</h1>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>Emitido em {emitido}</p>
                  </div>

                 {/* ÍCONES: tema e sair */}
                  <div className="flex items-center gap-2">
                    {/* Toggle tema (ícone-only) */}
                    <button
                      onClick={toggleTheme}
                      className="icon-btn icon-btn--ghost"
                      title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
                      aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
                    >
                      {theme === 'light' ? (
                        // lua
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 1 0 21 12.79z"/>
                        </svg>
                      ) : (
                        // sol
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="4"/>
                          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                        </svg>
                      )}
                    </button>

                    {/* Sair (ícone-only) */}
                    <button
                      type="button"
                      onClick={logout}
                      className="icon-btn icon-btn--danger"
                      title="Sair"
                      aria-label="Sair"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M10 3a2 2 0 0 0-2 2v3h2V5h8v14h-8v-3H8v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8zM11 8l-1.4 1.4L12.2 12H4v2h8.2l-2.6 2.6L11 18l5-5-5-5z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Cliente</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="input-plain block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                    >
                      <option value="">Selecione…</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {!customerId && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        Obrigatório para aplicar preço especial.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">E-mail do cliente</label>
                    <input
                      value={selectedCustomer?.email ?? ''}
                      readOnly
                      placeholder="—"
                      className="input-plain block w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ background: 'color-mix(in oklab, var(--card-bg) 85%, #0000)' }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Observação</label>
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Ex.: entregar no período da manhã"
                      className="input-plain block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs" style={{ borderColor:'var(--card-brd)', background:'var(--thead-bg)', color:'var(--thead-fg)' }}>
                    Itens: {items.length}
                  </span>
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs" style={{ borderColor:'var(--card-brd)', background:'var(--thead-bg)', color:'var(--thead-fg)' }}>
                    Total: {brl.format(total)}
                  </span>
                </div>
              </section>

              {/* Resumo */}
              <section className="card rounded-2xl border bg-white p-4 shadow-sm md:p-6">
                <h3 className="mb-3 text-base font-semibold tracking-tight">Resumo do pedido</h3>
                <div className="grid gap-4 text-sm">
                  <div>
                    <div style={{ color: 'var(--muted)' }}>Cliente</div>
                    <div className="font-medium">{selectedCustomer?.name ?? '—'}</div>
                  </div>
                  {/* SUBSTITUA o bloco de e-mail e telefone pelo grid abaixo */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div style={{ color: 'var(--muted)' }}>E-mail</div>
                        <div className="font-medium break-all">{selectedCustomer?.email ?? '—'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--muted)' }}>Telefone</div>
                        <div className="font-medium">{selectedCustomer?.phone ?? '—'}</div>
                      </div>
                    </div>
                  <div className="flex items-center justify-between">
                    <div style={{ color: 'var(--muted)' }}>Itens</div>
                    <div className="font-medium">{items.length}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div style={{ color: 'var(--muted)' }}>Total</div>
                    <div className="text-xl font-semibold">{brl.format(total)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)' }}>Observação</div>
                    <div className="font-medium">{notes || '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)' }}>Emitido em</div>
                    <div className="font-medium">{emitido}</div>
                  </div>
                </div>

                {/* Ações */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={saveOrder} className="icon-btn icon-btn--blue" title="Salvar pedido" aria-label="Salvar pedido">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v16h14V8.5L14.5 5H14v5H6V5h-1zm3 0v3h4V5H8z"/></svg>
                  </button>

                  <button
                    onClick={() => canPrint ? printPage() : pushToast('warning','Preencha cliente + 1 item com produto, quantidade (>0) e preço (>0).',{title:'Validação'})}
                    disabled={!canPrint}
                    className={`icon-btn icon-btn--ghost ${!canPrint ? 'disabled' : ''}`}
                    style={{ borderColor: 'var(--card-brd)', opacity: canPrint ? 1 : 0.5, pointerEvents: canPrint ? 'auto' : 'none' }}
                    title="Imprimir / PDF"
                    aria-label="Imprimir / PDF"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 9V4h12v5h-2V6H8v3H6zm-2 2h16a2 2 0 0 1 2 2v5h-4v4H6v-4H2v-5a2 2 0 0 1 2-2zm4 11h8v-6H8v6z"/></svg>
                  </button>

                  <button onClick={() => setShowClients(true)} className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Listar clientes" aria-label="Listar clientes">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.314 0-6 2.239-6 5v2h8v-2c0-1.86.85-3.5 2.188-4.594A7.88 7.88 0 0 0 8 13zm8 0c-3.314 0-6 2.239-6 5v2h12v-2c0-2.761-2.686-5-6-5z"/></svg>
                  </button>

                  <button onClick={() => setShowProducts(true)} className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Listar produtos" aria-label="Listar produtos">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4zm0 4l9 4 9-4v6l-9 4-9-4v-6z"/></svg>
                  </button>

                  <button onClick={() => setShowOrders(true)} className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Pedidos salvos" aria-label="Pedidos salvos">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 11h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>
                  </button>
                </div>
              </section>
            </aside>

            {/* DIREITA */}
            <div className="lg:col-span-8 lg:sticky lg:top-4 lg:self-start">
              <section className="card rounded-2xl border bg-white p-4 shadow-sm md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold tracking-tight">Itens do pedido</h2>

                  <div className="flex items-center gap-2">
                    <button onClick={addItem} disabled={products.length === 0} className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Adicionar item" aria-label="Adicionar item">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
                    </button>

                    <button onClick={clearAllItems} disabled={items.length === 0} className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)', opacity: items.length ? 1 : 0.5 }} title="Remover todos os itens" aria-label="Remover todos os itens">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l1 2h5v2H3V5h5l1-2zm-1 6h2v9H8V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9z"/></svg>
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border" style={{ borderColor:'var(--card-brd)' }}>
                  {/* Cabeçalho (~44px) + 13 linhas (~52px cada) */}
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(44px + 13 * 52px)' }}>
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[46%]" />
                        <col className="w-[10%]" />
                        <col className="w-[16%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[6%]" />
                      </colgroup>

                      <thead className="table-header">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide">
                          {[
                            <th key="desc" className="px-3 py-2.5">Descrição do produto</th>,
                            <th key="un" className="px-3 py-2.5 text-center">UN</th>,
                            <th key="preco" className="px-3 py-2.5">Preço</th>,
                            <th key="qtd" className="px-3 py-2.5">Qtd</th>,
                            <th key="total" className="px-3 py-2.5 text-right">Total</th>,
                            <th key="vazio" className="px-3 py-2.5" />,
                          ]}
                        </tr>
                      </thead>

                      <tbody>
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center" style={{ color:'var(--muted)' }}>
                              Nenhum item. Clique no botão <b>“+”</b>.
                            </td>
                          </tr>
                        )}

                        {items.map((it, idx) => {
                          const prod = products.find(p => p.id === it.productId);
                          return (
                            <tr key={idx} className="align-top hover:bg-black/[.03]">
                              {[
                                <td key="prod" className="px-3 py-2">
                                  <div className="space-y-1">
                                    <select
                                      value={it.productId}
                                      onChange={(e) => onChangeProduct(idx, e.target.value)}
                                      className="input-plain block w-full h-10 rounded-md border bg-white px-3 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                                    >
                                      {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>
                                    <div
                                      className="flex flex-wrap items-center gap-x-2 text-[11px]"
                                      style={{ color: 'var(--muted)' }}
                                    >
                                      <span className="truncate">{prod?.name ?? it.name}</span>
                                      <span className="hidden sm:inline">•</span>
                                      <span>{it.unit ?? prod?.unit ?? '-'}</span>
                                      <span className="hidden sm:inline">•</span>
                                      <span>{brl.format(Number(it.unitPrice || prod?.price || 0))} / un</span>
                                    </div>
                                  </div>
                                </td>,

                                <td key="un" className="px-3 py-2 text-center align-middle">
                                  {it.unit ?? prod?.unit ?? '-'}
                                </td>,

                                <td key="preco" className="px-3 py-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={it.unitPrice}
                                    onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) })}
                                    className="input-plain block w-full h-10 rounded-md border bg-white px-3 text-sm text-right focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                                  />
                                </td>,

                                <td key="qtd" className="px-3 py-2">
                                  <input
                                    type="number"
                                    min="1"
                                    value={it.quantity}
                                    onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                                    className="input-plain block w-full h-10 rounded-md border bg-white px-3 text-sm text-right focus:border-gray-900 focus:ring-2 focus:ring-gray-900"
                                  />
                                </td>,

                                <td key="tot" className="px-3 py-2 text-right font-medium align-middle">
                                  {brl.format(it.total)}
                                </td>,

                                <td key="rm" className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => removeItem(idx)}
                                    className="icon-btn icon-btn--ghost"
                                    style={{ borderColor: 'var(--card-brd)' }}
                                    title="Remover item"
                                    aria-label="Remover item"
                                  >
                                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                      <path d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/>
                                    </svg>
                                  </button>
                                </td>,
                              ]}
                            </tr>
                          );
                        })}

                      </tbody>

                      {items.length > 0 && (
                        <tfoot className="table-header">
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-right font-semibold">
                              Total: {brl.format(total)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* ===== MODAIS (Clientes / Produtos / Pedidos) ===== */}
        {/* (conteúdo idêntico ao que você já tinha — mantive acima) */}
        {/* CLIENTES */}
        {showClients && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
            <div className="modal-header">
  <div className="flex items-center gap-2">
    <h4 className="text-base font-semibold">Clientes</h4>
    <button
      className="icon-btn icon-btn--blue"
      title="Novo cliente"
      aria-label="Novo cliente"
      onClick={openNewClient}
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>
      </svg>
    </button>
  </div>
  <button
    className="icon-btn icon-btn--ghost"
    style={{ borderColor: 'var(--card-brd)' }}
    onClick={() => { setClientFormOpen(false); setShowClients(false); }}
    title="Fechar"
    aria-label="Fechar"
  >
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </button>
</div>
              <div className="p-3 flex gap-2">
                <input className="input-plain flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Buscar por nome, e-mail ou telefone…" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
              </div>
              {clientFormOpen && (
  <form
    onSubmit={(e) => { e.preventDefault(); saveClient(); }}
    className="px-3 pb-2"
  >
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--card-brd)' }}>
      <div className="grid gap-2 md:grid-cols-3"> {/* antes era 2 */}
        <div>
          <label className="mb-1 block text-xs font-medium">Nome</label>
          <input
            className="input-plain w-full rounded-lg border px-3 py-2 text-sm"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">E-mail</label>
          <input
            className="input-plain w-full rounded-lg border px-3 py-2 text-sm"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div>{/* + telefone */}
          <label className="mb-1 block text-xs font-medium">Telefone</label>
          <input
            type="tel"
            inputMode="tel"
            className="input-plain w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="(11) 99999-9999"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="icon-btn icon-btn--blue"
          title={clientEditing ? 'Salvar alterações' : 'Criar cliente'}
          aria-label={clientEditing ? 'Salvar alterações' : 'Criar cliente'}
          disabled={clientSaving}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 5v3h4V5H8z"/>
          </svg>
        </button>

        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          style={{ borderColor: 'var(--card-brd)' }}
          title="Cancelar"
          aria-label="Cancelar"
          onClick={() => setClientFormOpen(false)}
          disabled={clientSaving}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  </form>
)}



              <div className="modal-body">
                <table className="min-w-full text-sm">
                <thead className="table-header">
                  <tr>
                    {[
                      <th key="nome" className="px-3 py-2 text-left">Nome</th>,
                      <th key="email" className="px-3 py-2 text-left">E-mail</th>,
                      <th key="fone" className="px-3 py-2 text-left">Telefone</th>,
                      <th key="acoes" className="px-3 py-2 text-right">Ações</th>,
                    ]}
                  </tr>
                </thead>
                  <tbody>
                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>
                          Nenhum cliente encontrado.
                        </td>
                      </tr>
                    )}
                    {filteredCustomers.map(c => (                                        
                      <tr key={c.id} className="hover:bg-black/[.05]">
                        {[
                          <td key="nome" className="px-3 py-2">{c.name}</td>,
                          <td key="email" className="px-3 py-2">{c.email ?? '—'}</td>,
                          <td key="fone" className="px-3 py-2">{c.phone ?? '—'}</td>,
                          <td key="acoes" className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                            <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Editar" aria-label="Editar" onClick={() => openEditClient(c)}>
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
                            </button>
                            <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Excluir" aria-label="Excluir" onClick={() => deleteClient(c)}>
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l1 2h5v2H3V5h5l1-2zM7 9h2v9H7V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9z"/></svg>
                            </button>
                            </div>
                          </td>,
                        ]}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* PRODUTOS */}
        {showProducts && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
              <div className="modal-header">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold">Produtos</h4>
                  <button className="icon-btn icon-btn--blue" title="Novo produto" aria-label="Novo produto" onClick={openNewProduct}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>
                  </button>
                </div>
                <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} onClick={() => { setProductFormOpen(false); setShowProducts(false); }} title="Fechar" aria-label="Fechar">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              <div className="p-3 flex gap-2">
                <input className="input-plain flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Buscar por nome ou unidade…" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
              </div>

              {productFormOpen && (
                <div className="px-3 pb-2">
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--card-brd)' }}>
                    <div className="grid gap-2 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium">Descrição</label>
                        <input className="input-plain w-full rounded-lg border px-3 py-2 text-sm" value={productName} onChange={(e) => setProductName(e.target.value)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Unidade</label>
                        <input className="input-plain w-full rounded-lg border px-3 py-2 text-sm" value={productUnit} onChange={(e) => setProductUnit(e.target.value)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Preço</label>
                        <input type="number" min="0" step="0.01" className="input-plain w-full rounded-lg border px-3 py-2 text-sm text-right" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="icon-btn icon-btn--blue" title={productEditing ? 'Salvar alterações' : 'Criar produto'} aria-label={productEditing ? 'Salvar alterações' : 'Criar produto'} onClick={saveProduct} disabled={productSaving}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 5v3h4V5H8z"/></svg>
                      </button>
                      <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Cancelar" aria-label="Cancelar" onClick={() => setProductFormOpen(false)} disabled={productSaving}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-body">
                <table className="min-w-full text-sm">
                <thead className="table-header">
                  <tr>
                    {[
                      <th key="desc" className="px-3 py-2 text-left">Descrição</th>,
                      <th key="un" className="px-3 py-2">UN</th>,
                      <th key="preco" className="px-3 py-2 text-right">Preço</th>,
                      <th key="acoes" className="px-3 py-2 text-right">Ações</th>,
                    ]}
                  </tr>
                </thead>

                  <tbody>
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>
                          Nenhum produto encontrado.
                        </td>
                      </tr>
                    )}
                    {filteredProducts.map(p => {
                      const price = customerId ? findUnitPrice(customerId, p.id) : Number(p.price);
                      return (                   
                        <tr key={p.id} className="hover:bg-black/[.05]">
                        {[
                          <td key="desc" className="px-3 py-2">{p.name}</td>,
                          <td key="un" className="px-3 py-2 text-center">{p.unit ?? '-'}</td>,
                          <td key="preco" className="px-3 py-2 text-right">{brl.format(Number(price || 0))}</td>,
                          <td key="acoes" className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                            <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Editar" aria-label="Editar" onClick={() => openEditProduct(p)}>
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
                              </button>
                              <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Excluir" aria-label="Excluir" onClick={() => deleteProduct(p)}>
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l1 2h5v2H3V5h5l1-2zM7 9h2v9H7V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9z"/></svg>
                              </button>
                            </div>
                          </td>,
                        ]}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* PEDIDOS */}
        {showOrders && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
              <div className="modal-header">
                <h4 className="text-base font-semibold">Pedidos salvos</h4>
                <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} onClick={() => setShowOrders(false)} title="Fechar" aria-label="Fechar">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              <div className="p-3 flex items-center gap-2">
                <input className="input-plain flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Filtrar por nº do pedido ou cliente…" value={ordersFilter} onChange={(e) => setOrdersFilter(e.target.value)} />
                <button className="icon-btn icon-btn--ghost" style={{ borderColor: 'var(--card-brd)' }} title="Recarregar" aria-label="Recarregar" onClick={() => { setShowOrders(false); setTimeout(() => setShowOrders(true), 0); }}>
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6V3L8 7l4 4V8c2.757 0 5 2.243 5 5a5 5 0 0 1-9.33 2.5l-1.74 1A7 7 0 1 0 12 6z"/></svg>
                </button>
              </div>

              <div className="modal-body">
                {ordersLoading && <div className="px-3 py-6 text-sm">Carregando pedidos…</div>}
                {ordersError && <div className="px-3 py-6 text-sm text-red-600">{ordersError}</div>}
                {!ordersLoading && !ordersError && (
                  <table className="min-w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      {[
                        <th key="n" className="px-3 py-2 text-left">Nº</th>,
                        <th key="cliente" className="px-3 py-2 text-left">Cliente</th>,
                        <th key="itens" className="px-3 py-2 text-right">Itens</th>,
                        <th key="total" className="px-3 py-2 text-right">Total</th>,
                        <th key="emissao" className="px-3 py-2 text-left">Emissão</th>,
                        <th key="acoes" className="px-3 py-2 text-right">Ações</th>,
                      ]}
                    </tr>
                  </thead>
                    <tbody>
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>
                            Nenhum pedido encontrado.
                          </td>
                        </tr>
                      )}
                      {filteredOrders.map(o => {
                          const phone = normalizePhoneBR(o.customer?.phone);
                          const msg   = buildWhatsAppSummary(o); // resumo curtinho
                          const waLink = phone
                              ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
                              : `https://wa.me/?text=${encodeURIComponent(msg)}`; // fallback sem número
                        return (
                          <tr key={o.id} className="hover:bg-black/[.05]">
                           {[ 
                            <td key="n" className="px-3 py-2">#{o.number}</td>,
                            <td key="c" className="px-3 py-2">{o.customer?.name ?? '—'}</td>,
                            <td key="i" className="px-3 py-2 text-right">{o.items?.length ?? '—'}</td>,
                            <td key="t" className="px-3 py-2 text-right">{brl.format(Number(o.total || 0))}</td>,
                            <td key="d" className="px-3 py-2">{o.createdAt ? new Date(o.createdAt).toLocaleString('pt-BR') : '—'}</td>,
                            <td key="a" className="px-3 py-2">
                              <div className="flex justify-end gap-2">
                                {/* Visualizar (modal) */}
                                <button
                                  className="icon-btn icon-btn--ghost"
                                  style={{ borderColor: 'var(--card-brd)' }}
                                  title="Visualizar pedido"
                                  aria-label="Visualizar pedido"
                                  onClick={() => setOrderPreview(flattenOrderForPreview(o))}
                                >
                                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 4C4.5 4 1 12 1 12s3.5 8 11 8 11-8 11-8-3.5-8-11-8zm0 2c6 0 8.9 5.1 9.7 6-.8.9-3.7 6-9.7 6S3.1 12.9 2.3 12c.8-.9 3.7-6 9.7-6z"/>
                                    <path d="M12 9a3 3 0 1 0 .001 6.001A3 3 0 0 0 12 9z"/>
                                  </svg>
                                </button>
                                {/* E-mail (agora com anexo PDF) */}
                                <button
                                  className="icon-btn icon-btn--emerald"
                                  title="Enviar e-mail (com PDF)"
                                  aria-label="Enviar e-mail (com PDF)"
                                  onClick={() => sendOrderEmail(o)} // <=== já passa o objeto todo
                                >
                                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v.4l-10 6.25L2 6.4V6zm0 3.2V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9.2l-9.35 5.84a2 2 0 0 1-2.3 0L2 9.2z"/>
                                  </svg>
                                </button>

                                {/* WhatsApp (texto) */}
                                <a
                                  className="icon-btn icon-btn--green"
                                  title={phone ? "Enviar via WhatsApp" : "Sem telefone — abre só a mensagem"}
                                  aria-label="Enviar via WhatsApp"
                                  href={waLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5.2 13.2c-3.2 0-5.8-2.6-5.8-5.8 0-.6.5-1 1-1h1.2c.5 0 .9.4 1 .9.1.6.3 1.1.6 1.6.1.2 0 .5-.2.7l-.6.6c.7 1.2 1.8 2.2 3 2.9l.6-.6c.2-.2.5-.3.7-.2.5.3 1 .5 1.6.6.5.1.9.5.9 1v1.2c0 .5-.4 1-1 1h-1c-.6 0-1.2-.1-1.8-.3z"/>
                                  </svg>
                                </a>

                                {/* PDF (download) */}
                                <button
                                  className="icon-btn icon-btn--ghost"
                                  style={{ borderColor: 'var(--card-brd)' }}
                                  title="Baixar PDF"
                                  aria-label="Baixar PDF"
                                  onClick={() => downloadOrderPdf(o)}
                                >
                                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 14h-2v-4h-2v4H9l3 3 3-3zM13 3.5L18.5 9H13V3.5z"/>
                                  </svg>
                                </button>
                              </div>
                            </td>,
                          ]}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

            {/* VISUALIZAR PEDIDO */}
            {orderPreview && (
              <div className="modal-backdrop" role="dialog" aria-modal="true">
                <div className="modal-card" style={{ width: 'min(1000px, 96vw)' }}>
                  <div className="modal-header">
                    <h4 className="text-base font-semibold">
                      Visualizar pedido #{orderPreview.number}
                    </h4>
                    <button
                      className="icon-btn icon-btn--ghost"
                      style={{ borderColor: 'var(--card-brd)' }}
                      onClick={() => setOrderPreview(null)}
                      title="Fechar"
                        aria-label="Fechar"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="p-2">
                     <PrintSlip
                        o={orderPreview}
                        copyLabel="Pré-visualização"
                        onPrint={() => {
                          const prev = orderPreview;
                          if (!prev) return;
                          setSaved(prev);
                          setTimeout(() => window.print(), 30);
                          setTimeout(() => setSaved(null), 800);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}


      </div>

      {/* ====== IMPRESSÃO / PDF — 2 VIAS ====== */}
      <div className="only-print">
      {needsTwoSheets ? (
  <>
    <div className={`print-sheet ${printDensityClass}`}>
      <PrintSlip o={preview} copyLabel="1ª via — Cliente" />
    </div>

    <div style={{ breakAfter: 'page', pageBreakAfter: 'always' }} />

    <div className={`print-sheet ${printDensityClass}`}>
      <PrintSlip o={preview} copyLabel="2ª via — Empresa (resumida)" minimal />
    </div>
  </>
) : (
  <div className={`print-sheet ${printDensityClass}`}>
    <PrintSlip o={preview} copyLabel="1ª via — Cliente" />
    <hr className="print-cut" />
    <PrintSlip o={preview} copyLabel="2ª via — Empresa (resumida)" minimal />
  </div>
)}

      </div>

      {/* ====== TOASTS ====== */}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} data-toast-id={t.id} className={`toast toast--${t.kind}`} role="status">
            <div className="toast-left">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={iconFor(t.kind)} /></svg>
              <div className="toast-texts">
                {t.title && <div className="toast-title">{t.title}</div>}
                <div className="toast-msg">{t.message}</div>
              </div>
            </div>

            <div className="toast-actions">
              {t.actions?.map((a, i) => (
                <button key={i} className="toast-iconbtn" aria-label={a.ariaLabel} title={a.title || a.ariaLabel} onClick={a.onClick}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={a.svgPath} /></svg>
                </button>
              ))}
              <button className="toast-iconbtn" aria-label="Fechar" title="Fechar" onClick={() => dismissToast(t.id)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            {t.duration > 0 && (
              <span className="toast-progress" style={{ animationDuration: `${Math.min(Math.max(t.duration, 1500), 10000)}ms` }} />
            )}
          </div>
        ))}

        {/* CONFIRM (ícones apenas) */}
        {confirmState && (
          <div className="toast toast--confirm" role="alertdialog" aria-live="assertive" aria-label="Confirmação">
            <div className="toast-left">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={iconFor('warning')} /></svg>
              <div className="toast-texts">
                <div className="toast-title">Confirmar ação</div>
                <div className="toast-msg">{confirmState.message}</div>
              </div>
            </div>
            <div className="toast-actions">
              <button className="toast-iconbtn toast-yes" aria-label="Confirmar" title="Confirmar" onClick={confirmYes}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5L20 8.2 18.5 6.7z"/></svg>
              </button>
              <button className="toast-iconbtn" aria-label="Cancelar" title="Cancelar" onClick={confirmNo}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Estilos ===== */}
      <style jsx global>{`
        :root[data-theme="light"] {
          --bg: #f3f4f6;
          --card-bg: #ffffff;
          --card-brd: #cbd5e1;
          --thead-bg: #f1f5f9;
          --thead-fg: #0f172a;
          --muted: #475569;

          /* Toasts claros por padrão */
          --toast-bg: #ffffff;   /* fundo claro */
          --toast-fg: #0f172a;   /* texto escuro */
          --toast-brd: #cbd5e1;  /* borda suave */

          /* cores-acentos (bordas/botões) */
          --toast-success: #16a34a;
          --toast-error:   #dc2626;
          --toast-info:    #2563eb;
          --toast-warn:    #f59e0b;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }


        :root[data-theme="dark"] {
          --bg: #0b0b0c;
          --card-bg: #0f1115;
          --card-brd: #262a31;
          --thead-bg: #101317;
          --thead-fg: #e5e7eb;
          --muted: #9aa4b2;

          --toast-bg: #0f1115;
          --toast-fg: #e5e7eb;
          --toast-brd: #262a31;
          --toast-success: #10b981;
          --toast-error: #ef4444;
          --toast-info: #60a5fa;
          --toast-warn: #f59e0b;
        }
        html, body { background: var(--bg); }

        .card { border-color: var(--card-brd) !important; }
        .table-header { background: var(--thead-bg); color: var(--thead-fg); }
        .input-plain { color: #111; border-color: #000 !important; }
        :root[data-theme="dark"] .input-plain { color: #f8fafc; }

        /* ===== ÍCONES / BOTÕES DE ÍCONE ===== */
        .icon-btn{
          display:inline-flex; align-items:center; justify-content:center;
          width:30px; height:30px;                 /* antes 36x36 */
          border-radius:8px;                        /* antes 10px */
          border:1px solid transparent;
          background:#111; color:#fff;
        }
        .icon-btn svg{ width:16px; height:16px; }   /* antes 18x18 */

        .icon-btn--ghost{ background:transparent; color:#111; }
        :root[data-theme="dark"] .icon-btn--ghost{ color:#e5e7eb; }
        .icon-btn--blue{ background:#2563eb; }
        .icon-btn--emerald{ background:#059669; }
        .icon-btn--green{ background:#16a34a; }
        .icon-btn.disabled{ opacity:.5; pointer-events:none; }

        /* Variante "danger" para ícone Sair */
          .icon-btn--danger{
            background: transparent;
            color: #dc2626;                 /* red-600 */
            border-color: var(--card-brd);
          }
          .icon-btn--danger:hover{
            background: rgba(220, 38, 38, 0.08);
          }

          /* Melhor contraste no dark mode */
          :root[data-theme="dark"] .icon-btn--danger{
            color: #f87171;                 /* red-400 */
          }
          :root[data-theme="dark"] .icon-btn--danger:hover{
            background: rgba(239, 68, 68, 0.15);
          }

        .screen-only { display:block; }
        .only-print { display:none; }
     @media print {
      /* Tamanho e área útil */
      @page { size: A4 portrait; margin: 8mm; }

      /* Garante que nada adiciona margem “extra” */
      html, body { margin: 0 !important; padding: 0 !important; height: auto !important; }

      /* Mostra só a área de impressão */
      .screen-only { display: none !important; }
      .only-print  { display: block !important; margin: 0 !important; padding: 0 !important; }

      /* A folha de impressão não deve forçar quebra depois */
      .print-sheet {
        margin: 0 !important;
        padding: 0 !important;             /* já evita somar padding com a margem da página */
        break-after: auto !important;       /* spec */
        page-break-after: auto !important;  /* legado */
      }

      /* Não deixe o último filho forçar nova página */
      .only-print > *:last-child {
        break-after: auto !important;
        page-break-after: auto !important;
      }

      /* Evita quebra dentro de cada via */
      .copy {
        break-inside: avoid;
        page-break-inside: avoid;
        -webkit-column-break-inside: avoid;
      }

      /* O traço de corte não deve “estourar” a página */
      .print-cut { margin: 4mm 0 !important; }  /* era 8mm, reduz um pouco */
    }



        .print-sheet { padding:8mm 10mm; }
        .print-scale-sm { font-size:0.9rem; }
        .print-scale-xs { font-size:0.82rem; }
        .copy { page-break-inside: avoid; }
        .copy-header { display:flex; align-items:center; gap:10px; margin-bottom:6mm; }
        .copy-title { font-weight:700; font-size:16px; }
        .copy-sub { font-size:11px; color:#555; }
        /* Botão de impressão dentro do badge (somente na tela) */
        .copy-badge-btn{
          --icon-size: 24px;          /* tamanho do botão/ícone */
          --icon-svg: 20px;           /* tamanho do SVG dentro */
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:var(--icon-size); height:var(--icon-size);
          padding:0; border:0; background:transparent;
          color: currentColor; cursor:pointer;
          border-radius:6px;
         }
         .copy-badge-btn svg{
           width:var(--icon-svg); height:var(--icon-svg);
         }
         .copy-badge-btn:hover{
           background: color-mix(in oklab, currentColor 10%, transparent);
           opacity:.95;
         }

        /* Mostrar só na tela; ocultar na impressão */
        .screen-inline-only{ display:inline-flex; }
        @media print{
          .screen-inline-only{ display:none !important; }
        }
        .copy-badge {
          --badge-gap: 10px;          /* espaço entre texto e ícones */
          margin-left: auto;
          font-size: 11px;
          border: 1px solid #333;
          padding: 3px 10px;          /* um pouco mais de “respiro” */
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: var(--badge-gap);
        }
        .copy-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin-bottom:6mm; }
        .copy-field label { display:block; font-size:10px; color:#555; }
        .copy-contact{
          display: grid;
          grid-template-columns: 1fr 1fr; /* email | phone */
          gap: 0 12px;
          font-size: 10px;
        }
        .copy-contact span{
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .copy-field--full{
          grid-column: 1 / -1;         /* Observação ocupa as duas colunas */
        }
        .copy-field .obs{
          font-size: 10px;
          white-space: pre-wrap;       /* respeita quebras de linha digitadas */
          word-break: break-word;      /* quebra palavras grandes */
        }
  
        .copy-table { width:100%; border-collapse: collapse; font-size:12px; }
        .copy-table th, .copy-table td { border:1px solid #111; padding:6px; }
        .copy-table .center { text-align:center; }
        .copy-table .num { text-align:right; }
        .copy-table .desc { max-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .copy-footer { display:flex; align-items:center; gap:10mm; margin-top:6mm; }
        .sign-line { flex:1; border-top:1px dashed #111; text-align:center; padding-top:4mm; font-size:10px; }
        .print-cut { border:none; border-top:1px dashed #999; margin:8mm 0; }

        .modal-backdrop { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.55); display:flex; align-items:flex-start; justify-content:center; padding:24px; }
        .modal-card { width:min(980px,96vw); max-height:85vh; background:var(--card-bg); color:#111; border:1px solid var(--card-brd); border-radius:14px; box-shadow:0 10px 35px rgba(0,0,0,.25); display:flex; flex-direction:column; overflow:hidden; }
        :root[data-theme="dark"] .modal-card { color:#e5e7eb; }
        .modal-header { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--card-brd); }
        .modal-body { padding:8px 12px; overflow:auto; }
        .modal-body table th, .modal-body table td { border-bottom:1px solid #e5e7eb; }
        :root[data-theme="dark"] .modal-body table th, :root[data-theme="dark"] .modal-body table td { border-bottom-color:#1f2937; }

       /* ===== TOASTS: canto inferior direito ===== */
        .toast-stack{
          position: fixed;
          right: clamp(12px, 2vw, 24px);
          bottom: clamp(12px, 2vh, 24px);
          left: auto;
          top: auto;
          transform: none;
          width: min(92vw, 420px);
          display: flex;
          flex-direction: column-reverse; /* toast novo fica colado no canto */
          align-items: flex-end;
          gap: 10px;
          z-index: 80;
          pointer-events: none; /* mantém clique só nos botões dos toasts */
        }
        .toast{ width:100%; }

        @media (max-width: 640px){
          .toast-stack{
            right: 12px;
            bottom: 12px;
            width: min(94vw, 420px);
          }
        }


        /* Base dos toasts no tema CLARO */
        :root[data-theme="light"] .toast {
          background: var(--toast-bg);
          color: var(--toast-fg);
          border-color: var(--toast-brd);
          box-shadow: 0 8px 24px rgba(15,23,42,.08);
        }

        /* Botões de ação dentro do toast (tema CLARO) */
        :root[data-theme="light"] .toast .toast-iconbtn {
          color: currentColor;
          border-color: #94a3b8;          /* slate-400 */
        }
        :root[data-theme="light"] .toast .toast-iconbtn:hover {
          background: #f1f5f9;            /* slate-100 */
        }

        /* Paletas suaves por tipo (tema CLARO) */
        :root[data-theme="light"] .toast--success {
          background: #f0fdf4;            /* green-50 */
          color: #065f46;                 /* green-900 */
          border-color: #34d399;          /* green-400 */
        }
        :root[data-theme="light"] .toast--error {
          background: #fef2f2;            /* red-50 */
          color: #7f1d1d;                 /* red-900 */
          border-color: #fca5a5;          /* red-300/400 */
        }
        :root[data-theme="light"] .toast--info {
          background: #eff6ff;            /* blue-50 */
          color: #1e3a8a;                 /* blue-900 */
          border-color: #93c5fd;          /* blue-300 */
        }
        :root[data-theme="light"] .toast--warning,
        :root[data-theme="light"] .toast--confirm {
          background: #fffbeb;            /* amber-50 */
          color: #92400e;                 /* amber-900 */
          border-color: #fbbf24;          /* amber-400 */
        }

        /* Botão confirmar continua “verde” mesmo em fundo claro */
        :root[data-theme="light"] .toast-yes {
          border-color: var(--toast-success);
          color: var(--toast-success);
        }
        :root[data-theme="light"] .toast-yes:hover {
          background: color-mix(in oklab, var(--toast-success) 12%, transparent);
        }



        @media (max-width: 640px) {
          .toast-stack { left: 12px; right: 12px; bottom: 12px; }
        }
        .toast {
          pointer-events: auto;
          display:flex; align-items:center; justify-content:space-between; gap:12px;
          min-width:280px; max-width:420px;
          border-radius:12px; padding:10px 10px 12px 12px;
          background:var(--toast-bg); color:var(--toast-fg);
          border:1px solid var(--toast-brd);
          box-shadow:0 10px 30px rgba(0,0,0,.35);
          transform: translateY(8px); opacity: 0;
          animation: toast-in .18s ease-out forwards;
          position: relative; overflow: hidden;
        }
        .toast-left { display:flex; align-items:flex-start; gap:10px; }
        .toast-left svg { width:18px; height:18px; flex-shrink:0; margin-top:2px; }
        .toast-texts { display:flex; flex-direction:column; gap:2px; }
        .toast-title { font-size:13px; font-weight:600; opacity:.95; }
        .toast-msg { font-size:13px; line-height:1.25; opacity:.95; }

        .toast-actions { display:flex; align-items:center; gap:6px; }
        .toast-iconbtn { width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; background:transparent; border:1px solid #374151; color:#e5e7eb; }
        .toast-iconbtn svg { width:16px; height:16px; }
        .toast-iconbtn:hover { background:#111827; }

        .toast--success { border-color: var(--toast-success); }
        .toast--error   { border-color: var(--toast-error); }
        .toast--info    { border-color: var(--toast-info); }
        .toast--warning,
        .toast--confirm { border-color: var(--toast-warn); }

        .toast-yes {
          border-color: var(--toast-success);
          color: var(--toast-success);
        }
        .toast-yes:hover { background: color-mix(in oklab, var(--toast-success) 15%, transparent); }

        .toast-progress {
          position:absolute; left:0; bottom:0; height:2px; width:100%;
          background: currentColor; opacity:.45;
          animation-name: toast-progress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        .toast:hover .toast-progress { animation-play-state: paused; }

        @keyframes toast-in {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes toast-progress {
          from { transform: translateX(0); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
    </>
  );
}
