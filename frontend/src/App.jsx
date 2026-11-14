import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
const initialProduct = {sku:'',name:'',description:'',category:'General',unit:'pcs',unit_price:0,stock_quantity:0,reorder_level:5,supplier_id:''};

export default function App(){
  const [page,setPage]=useState('Overview'), [dashboard,setDashboard]=useState(null), [products,setProducts]=useState([]),
    [suppliers,setSuppliers]=useState([]), [transactions,setTransactions]=useState([]), [search,setSearch]=useState(''),
    [transactionType,setTransactionType]=useState(''), [lowStockOnly,setLowStockOnly]=useState(false),
    [modal,setModal]=useState(''), [productForm,setProductForm]=useState(initialProduct), [supplierForm,setSupplierForm]=useState({name:'',email:'',phone:'',address:''}),
    [movement,setMovement]=useState({product_id:'',transaction_type:'RECEIPT',quantity:1,unit_cost:'',reference:'',notes:''}),
    [editing,setEditing]=useState(null), [notice,setNotice]=useState({type:'',text:''}), [busy,setBusy]=useState(false),
    [refreshing,setRefreshing]=useState(false), [connectionError,setConnectionError]=useState(false), [lastUpdated,setLastUpdated]=useState(null),
    [adminProfile,setAdminProfile]=useState(()=>({name:localStorage.getItem('stockpilot.admin.name')||'Admin User',email:localStorage.getItem('stockpilot.admin.email')||'admin@stockpilot.local'})),
    [profileForm,setProfileForm]=useState({name:'',email:''}), [profileOpen,setProfileOpen]=useState(false);
  const notify = (type,text)=>{setNotice({type,text}); window.setTimeout(()=>setNotice({type:'',text:''}),4000)};
  const refresh=useCallback(async (quiet=false)=>{
    if(!quiet)setRefreshing(true);
    try { const [d,p,s,t]=await Promise.all([api.dashboard(),api.products(search),api.suppliers(),api.transactions(search,transactionType)]);
      setDashboard(d);setProducts(p);setSuppliers(s);setTransactions(t);
      setLastUpdated(new Date());setConnectionError(false);
    } catch(e){setConnectionError(true);if(!quiet)notify('error',e.message);}
    finally{if(!quiet)setRefreshing(false);}
  },[search,transactionType]);
  useEffect(()=>{
    refresh();
    const interval=window.setInterval(()=>refresh(true),10000);
    return ()=>window.clearInterval(interval);
  },[refresh]);
  const categories=useMemo(()=>['All categories',...new Set(products.map(p=>p.category))],[products]);
  const [category,setCategory]=useState('All categories');
  const visibleProducts=products.filter(p=>(category==='All categories'||p.category===category)&&(!lowStockOnly||p.low_stock));
  async function run(action){
    setBusy(true);
    try{await action();setModal('');await refresh();notify('success','Changes saved successfully.');}
    catch(e){notify('error',e.message);}finally{setBusy(false);}
  }
  function openProduct(p=null){setEditing(p?.id||null);setProductForm(p?{...p,supplier_id:p.supplier_id||''}:initialProduct);setModal('product');}
  function restock(p){setMovement({...movement,product_id:String(p.id),transaction_type:'RECEIPT',quantity:1,unit_cost:'',reference:'',notes:''});setModal('movement');}
  function exportTransactions(){
    const cell=value=>{const text=String(value??'');return `"${(/^[=+\-@]/.test(text)?`'${text}`:text).replace(/"/g,'""')}"`;};
    const rows=[['Product','SKU','Type','Quantity','Reference','Date'],...transactions.map(t=>[t.product_name,t.sku,t.transaction_type,t.quantity,t.reference,new Date(t.created_at+'Z').toLocaleString()])];
    const blob=new Blob(['\uFEFF',rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`stockpilot-transactions-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
  }
  function saveProduct(e){e.preventDefault();const data={...productForm,unit_price:Number(productForm.unit_price),stock_quantity:Number(productForm.stock_quantity),reorder_level:Number(productForm.reorder_level),supplier_id:productForm.supplier_id?Number(productForm.supplier_id):null};
    run(()=>editing?api.updateProduct(editing,data):api.addProduct(data));}
  function saveSupplier(e){e.preventDefault();run(()=>api.addSupplier(supplierForm));}
  function saveMovement(e){e.preventDefault();run(()=>api.movement({...movement,product_id:Number(movement.product_id),quantity:Number(movement.quantity),unit_cost:movement.unit_cost===''?null:Number(movement.unit_cost)}));}
  function saveAdminProfile(e){
    e.preventDefault();
    const updated={name:profileForm.name.trim(),email:profileForm.email.trim()};
    if(!updated.name||!updated.email){notify('error','Enter a name and email address.');return;}
    try{
      localStorage.setItem('stockpilot.admin.name',updated.name);
      localStorage.setItem('stockpilot.admin.email',updated.email);
    }catch{
      notify('error','Could not save the profile in this browser. Check browser storage permissions.');
      return;
    }
    setAdminProfile(updated);setModal('');notify('success','Admin profile updated.');
  }
  const adminInitials=adminProfile.name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
  const nav=[['Overview','▦'],['Products','▣'],['Suppliers','♧'],['Stock movement','⇄'],['Transactions','◷']];
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">S</span><div><b>StockPilot</b><small>INVENTORY SUITE</small></div></div>
      <div className="nav-label">WORKSPACE</div>{nav.map(([name,icon])=><button key={name} className={`nav-item ${page===name?'active':''}`} onClick={()=>{setPage(name);setProfileOpen(false)}}><span>{icon}</span>{name}</button>)}
      <div className="side-bottom"><div className="status-dot"/> System operational <small>v1.0.0</small></div>
    </aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">INVENTORY MANAGEMENT</div><h1>{page}</h1></div><div className="top-actions"><span className={`live ${connectionError?'offline':''}`} title="Dashboard data refreshes automatically every 10 seconds"><i/>{connectionError?'Connection issue':lastUpdated?`Synced ${lastUpdated.toLocaleTimeString()}`:'Connecting...'}</span><button className="refresh-btn" onClick={()=>refresh()} disabled={refreshing} title="Refresh inventory now"><span className={refreshing?'spin':''}>↻</span><span>{refreshing?'Syncing':'Refresh'}</span></button><div className="profile-wrap"><button className="avatar" aria-label="Open admin profile menu" aria-expanded={profileOpen} onClick={()=>setProfileOpen(!profileOpen)}>{adminInitials}</button>{profileOpen&&<div className="profile-menu"><div className="profile-summary"><b>{adminProfile.name}</b><small>{adminProfile.email}</small><span className="profile-role">Administrator</span></div><button onClick={()=>{setProfileForm(adminProfile);setModal('profile');setProfileOpen(false)}}>Manage profile <span>→</span></button></div>}</div></div></header>
      {notice.text&&<div className={`toast ${notice.type}`}>{notice.type==='error'?'⚠':'✓'} {notice.text}</div>}
      {page==='Overview'&&<section>
        <div className="welcome"><div><p className="eyebrow light">YOUR BUSINESS AT A GLANCE</p><h2>Inventory overview</h2><p>Track stock, monitor supplies and stay ahead of low inventory.</p></div><button className="btn btn-white" onClick={()=>{setMovement({...movement,transaction_type:'RECEIPT'});setModal('movement')}}>＋ Record stock</button></div>
        <div className="stats">
          <Stat icon="▣" label="Total products" value={dashboard?.total_products??'—'} tone="blue" hint="Active catalog items"/>
          <Stat icon="▤" label="Units in stock" value={dashboard?.total_units??'—'} tone="violet" hint="Across all products"/>
          <Stat icon="⚑" label="Low stock alerts" value={dashboard?.low_stock_count??'—'} tone="orange" hint="Click to review items" onClick={()=>{setLowStockOnly(true);setCategory('All categories');setPage('Products')}}/>
          <Stat icon="₹" label="Inventory value" value={money(dashboard?.inventory_value)} tone="green" hint="Based on unit price"/>
        </div>
        <div className="dashboard-grid"><div className="panel"><div className="panel-head"><div><h3>Low stock alerts</h3><p>Products that need replenishment</p></div><button className="text-btn" onClick={()=>setPage('Products')}>View products →</button></div>
          {dashboard?.low_stock_products?.length?dashboard.low_stock_products.map(p=><div className="alert-row" key={p.id}><div className="product-icon">▣</div><div className="grow"><b>{p.name}</b><small>{p.sku} · {p.category}</small></div><div className="stock-count"><b>{p.stock_quantity} {p.unit}</b><small>Reorder at {p.reorder_level}</small></div><span className="pill warning">Low stock</span><button className="text-btn restock-btn" onClick={()=>restock(p)}>＋ Restock</button></div>):<Empty text="All products are sufficiently stocked."/>}
        </div><div className="panel"><div className="panel-head"><div><h3>Quick actions</h3><p>Common inventory tasks</p></div></div>
          <button className="quick-action" onClick={()=>openProduct()}><span className="quick-icon blue-bg">＋</span><span><b>Add new product</b><small>Create a product in your catalog</small></span><strong>→</strong></button>
          <button className="quick-action" onClick={()=>{setSupplierForm({name:'',email:'',phone:'',address:''});setModal('supplier')}}><span className="quick-icon green-bg">♧</span><span><b>Add supplier</b><small>Register a new supplier</small></span><strong>→</strong></button>
          <button className="quick-action" onClick={()=>setModal('movement')}><span className="quick-icon orange-bg">⇄</span><span><b>Stock movement</b><small>Record receipt or issue</small></span><strong>→</strong></button>
        </div></div>
        <div className="panel table-panel"><div className="panel-head"><div><h3>Recent transactions</h3><p>Latest stock activity</p></div><button className="text-btn" onClick={()=>setPage('Transactions')}>All transactions →</button></div><TransactionTable rows={dashboard?.recent_transactions||[]}/></div>
      </section>}
      {page==='Products'&&<section><div className="section-toolbar"><div><h2>Product catalog</h2><p>Manage your products and stock thresholds.</p></div><button className="btn btn-primary" onClick={()=>openProduct()}>＋ Add product</button></div>
        <div className="filterbar"><input placeholder="Search name, SKU or category..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select><button className={`filter-toggle ${lowStockOnly?'selected':''}`} onClick={()=>setLowStockOnly(!lowStockOnly)}>⚑ {lowStockOnly?'Low stock only · On':'Low stock only'}</button></div>
        <div className="panel table-panel"><ProductTable rows={visibleProducts} onEdit={openProduct} onDelete={p=>{if(confirm(`Delete ${p.name}?`))run(()=>api.deleteProduct(p.id))}}/></div></section>}
      {page==='Suppliers'&&<section><div className="section-toolbar"><div><h2>Suppliers</h2><p>Keep supplier contact details organized.</p></div><button className="btn btn-primary" onClick={()=>{setSupplierForm({name:'',email:'',phone:'',address:''});setModal('supplier')}}>＋ Add supplier</button></div>
        <div className="supplier-grid">{suppliers.map(s=><div className="panel supplier-card" key={s.id}><div className="supplier-avatar">{s.name.slice(0,1).toUpperCase()}</div><h3>{s.name}</h3><p>{s.email||'No email provided'}</p><div className="supplier-detail">☎ {s.phone||'No phone'}</div><div className="supplier-detail">⌖ {s.address||'No address'}</div></div>)}{!suppliers.length&&<Empty text="No suppliers yet. Add your first supplier."/>}</div></section>}
      {page==='Stock movement'&&<section><div className="section-toolbar"><div><h2>Stock movement</h2><p>Record stock received from suppliers or issued from inventory.</p></div></div><div className="movement-layout"><div className="panel movement-card"><h3>Record a movement</h3><p className="muted">Every movement is stored in the transaction history.</p><MovementForm products={products} value={movement} setValue={setMovement} onSubmit={saveMovement} busy={busy}/></div><div className="panel guidance"><h3>Stock control rules</h3><div className="rule"><span className="rule-icon green-bg">＋</span><div><b>Stock receipt</b><p>Increases available inventory. Use this when new goods arrive.</p></div></div><div className="rule"><span className="rule-icon orange-bg">−</span><div><b>Stock issue</b><p>Decreases inventory. The API rejects issues greater than available stock.</p></div></div><div className="rule"><span className="rule-icon blue-bg">✓</span><div><b>Audit history</b><p>Every successful movement is recorded with quantity, date and reference.</p></div></div></div></div></section>}
      {page==='Transactions'&&<section><div className="section-toolbar"><div><h2>Transaction history</h2><p>Review every stock receipt and issue.</p></div><div className="toolbar-actions"><button className="btn btn-ghost" onClick={exportTransactions} disabled={!transactions.length}>↓ Export CSV</button><button className="btn btn-primary" onClick={()=>setModal('movement')}>＋ New movement</button></div></div><div className="filterbar"><input placeholder="Search product, SKU or reference..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={transactionType} onChange={e=>setTransactionType(e.target.value)}><option value="">All movement types</option><option value="RECEIPT">Receipts</option><option value="ISSUE">Issues</option></select></div><div className="panel table-panel"><TransactionTable rows={transactions}/></div></section>}
      <footer>StockPilot Inventory Suite <span>•</span> Built with React, FastAPI & SQL Server</footer>
    </main>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('')}}><div className="modal"><div className="modal-head"><div><h2>{modal==='profile'?'Admin profile':modal==='product'?(editing?'Edit product':'Add product'):modal==='supplier'?'Add supplier':'Record stock movement'}</h2><p>Enter the details below to continue.</p></div><button className="close" onClick={()=>setModal('')}>×</button></div>
      {modal==='product'&&<form onSubmit={saveProduct} className="form-grid"><Field label="SKU *"><input required value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})}/></Field><Field label="Product name *"><input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></Field><Field label="Category"><input value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}/></Field><Field label="Unit"><input value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}/></Field><Field label="Unit price (₹)"><input type="number" min="0" step="0.01" value={productForm.unit_price} onChange={e=>setProductForm({...productForm,unit_price:e.target.value})}/></Field><Field label="Opening stock"><input type="number" min="0" disabled={!!editing} value={productForm.stock_quantity} onChange={e=>setProductForm({...productForm,stock_quantity:e.target.value})}/></Field><Field label="Reorder level"><input type="number" min="0" value={productForm.reorder_level} onChange={e=>setProductForm({...productForm,reorder_level:e.target.value})}/></Field><Field label="Supplier"><select value={productForm.supplier_id} onChange={e=>setProductForm({...productForm,supplier_id:e.target.value})}><option value="">No supplier</option>{suppliers.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></Field><Field label="Description" full><textarea value={productForm.description||''} onChange={e=>setProductForm({...productForm,description:e.target.value})}/></Field><div className="form-actions"><button type="button" className="btn btn-ghost" onClick={()=>setModal('')}>Cancel</button><button disabled={busy} className="btn btn-primary">{busy?'Saving...':'Save product'}</button></div></form>}
      {modal==='supplier'&&<form onSubmit={saveSupplier} className="form-grid"><Field label="Supplier name *" full><input required minLength="2" value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm,name:e.target.value})}/></Field><Field label="Email"><input type="email" value={supplierForm.email} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})}/></Field><Field label="Phone"><input value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm,phone:e.target.value})}/></Field><Field label="Address" full><textarea value={supplierForm.address} onChange={e=>setSupplierForm({...supplierForm,address:e.target.value})}/></Field><div className="form-actions"><button type="button" className="btn btn-ghost" onClick={()=>setModal('')}>Cancel</button><button disabled={busy} className="btn btn-primary">Save supplier</button></div></form>}
      {modal==='profile'&&<form onSubmit={saveAdminProfile} className="form-grid"><Field label="Full name *" full><input required minLength="2" autoFocus value={profileForm.name} onChange={e=>setProfileForm({...profileForm,name:e.target.value})}/></Field><Field label="Email address *" full><input required type="email" value={profileForm.email} onChange={e=>setProfileForm({...profileForm,email:e.target.value})}/></Field><Field label="Role" full><input value="Administrator" readOnly/></Field><div className="form-actions"><button type="button" className="btn btn-ghost" onClick={()=>setModal('')}>Cancel</button><button className="btn btn-primary">Save profile</button></div></form>}
      {modal==='movement'&&<MovementForm products={products} value={movement} setValue={setMovement} onSubmit={saveMovement} busy={busy} modal/>}
    </div></div>}
  </div>
}
function Stat({icon,label,value,tone,hint,onClick}){const content=<><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></>;return onClick?<button className="stat-card interactive" onClick={onClick}>{content}</button>:<div className="stat-card">{content}</div>}
function Field({label,children,full}){return <label className={`field ${full?'full':''}`}><span>{label}</span>{children}</label>}
function Empty({text}){return <div className="empty"><span>✓</span>{text}</div>}
function ProductTable({rows,onEdit,onDelete}){return <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>IN STOCK</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><b>{p.name}</b><small>{p.sku}</small></td><td>{p.category}</td><td>{money(p.unit_price)}</td><td><b>{p.stock_quantity}</b> {p.unit}</td><td><span className={`pill ${p.low_stock?'warning':'success'}`}>{p.low_stock?'Low stock':'In stock'}</span></td><td><button className="icon-btn" title="Edit" onClick={()=>onEdit(p)}>✎</button><button className="icon-btn danger" title="Delete" onClick={()=>onDelete(p)}>×</button></td></tr>)}</tbody></table>{!rows.length&&<Empty text="No products match your search."/>}</div>}
function TransactionTable({rows}){return <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>TYPE</th><th>QUANTITY</th><th>REFERENCE</th><th>DATE</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><b>{t.product_name}</b><small>{t.sku}</small></td><td><span className={`pill ${t.transaction_type==='RECEIPT'?'success':'issued'}`}>{t.transaction_type}</span></td><td><b>{t.quantity}</b></td><td>{t.reference||'—'}</td><td>{new Date(t.created_at+'Z').toLocaleString()}</td></tr>)}</tbody></table>{!rows.length&&<Empty text="No transactions recorded yet."/>}</div>}
function MovementForm({products,value,setValue,onSubmit,busy,modal=false}){return <form onSubmit={onSubmit} className={`movement-form ${modal?'modal-form':''}`}><Field label="Movement type"><select value={value.transaction_type} onChange={e=>setValue({...value,transaction_type:e.target.value})}><option value="RECEIPT">Stock receipt (+)</option><option value="ISSUE">Stock issue (−)</option></select></Field><Field label="Product *"><select required value={value.product_id} onChange={e=>setValue({...value,product_id:e.target.value})}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.stock_quantity} {p.unit} available</option>)}</select></Field><Field label="Quantity *"><input required type="number" min="1" value={value.quantity} onChange={e=>setValue({...value,quantity:e.target.value})}/></Field><Field label="Unit cost (₹)"><input type="number" min="0" step="0.01" value={value.unit_cost} onChange={e=>setValue({...value,unit_cost:e.target.value})}/></Field><Field label="Reference number"><input placeholder="e.g. PO-1001" value={value.reference} onChange={e=>setValue({...value,reference:e.target.value})}/></Field><Field label="Notes"><input placeholder="Optional notes" value={value.notes} onChange={e=>setValue({...value,notes:e.target.value})}/></Field><button className="btn btn-primary submit-movement" disabled={busy||!products.length}>{busy?'Saving movement':'Confirm movement'}</button></form>}
