// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Lock, ChevronLeft, ChevronDown, Package, Calculator, DollarSign, Beef, Carrot, Fish, Coffee, CheckCircle, AlertCircle, Utensils, Plus, Trash2, Edit2, Pencil, Check, StickyNote, Layers, ChevronRight, Store, Settings, Save, Scale, Receipt, FolderPlus, Tag, Type, Download, Upload, RotateCcw, X, Database, CalendarDays, TrendingUp } from 'lucide-react';

// ==========================================
// 本機資料儲存（獨立版，不再連接任何雲端或進貨系統）
// 所有資料存放在瀏覽器 localStorage，可於「成本參數」頁匯出 / 匯入備份
// ==========================================
const STORAGE_KEY = 'cost-management-system-data-v1';

const newUid = () => `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const withUids = (list) => list.map((item) => ({ ...item, uid: item.uid || newUid() }));

// 舊版曾內建範例食材與商品；只移除「與範例完全相同、未被修改」的項目
const stripSampleData = (data) => {
  const strip = (o) => { const { uid, ...rest } = o || {}; return JSON.stringify(rest, Object.keys(rest).sort()); };
  const sampleRaw = new Set(SAMPLE_RAW_DATA.map(strip));
  const rawErpData = Array.isArray(data.rawErpData) ? data.rawErpData.filter(i => !sampleRaw.has(strip(i))) : data.rawErpData;
  const keptNames = new Set((rawErpData || []).map(i => i.name));
  let productRules = data.productRules;
  if (productRules && typeof productRules === 'object') {
    productRules = { ...productRules };
    Object.keys(SAMPLE_RULES).forEach(name => {
      if (!keptNames.has(name) && JSON.stringify(productRules[name]) === JSON.stringify(SAMPLE_RULES[name])) delete productRules[name];
    });
  }
  const sampleMenu = JSON.stringify(SAMPLE_SET_MENUS[0]);
  const setMenus = Array.isArray(data.setMenus) ? data.setMenus.filter(m => JSON.stringify(m) !== sampleMenu) : data.setMenus;
  return { ...data, rawErpData, productRules, setMenus, samplesRemoved: true };
};

const loadSavedData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data.samplesRemoved ? data : stripSampleData(data);
  } catch (e) {
    console.error('讀取本機資料失敗:', e);
    return null;
  }
};

// 極簡金融風格：單色輪廓圖示與極簡底色
const getIconByCategory = (categoryName) => {
  if (!categoryName) return <Coffee className="w-6 h-6 text-black" strokeWidth={1.5} />;
  if (categoryName.includes('肉')) return <Beef className="w-6 h-6 text-black" strokeWidth={1.5} />;
  if (categoryName.includes('菜') || categoryName.includes('蔬')) return <Carrot className="w-6 h-6 text-black" strokeWidth={1.5} />;
  if (categoryName.includes('海') || categoryName.includes('魚') || categoryName.includes('蝦')) return <Fish className="w-6 h-6 text-black" strokeWidth={1.5} />;
  return <Coffee className="w-6 h-6 text-black" strokeWidth={1.5} />;
};

const getColorByCategory = () => {
  return 'bg-[#F9F9F9] border-neutral-200 text-black';
};

// 初始原始資料
const SAMPLE_RAW_DATA = [
  { category: '肉類', vendor: '美福頂級肉品', name: '無骨雞腿肉', code: 'M001', rawPrice: 120, unit: 'kg' },
  { category: '肉類', vendor: '美福頂級肉品', name: '特級牛五花', code: 'M002', rawPrice: 350, unit: 'kg' },
  { category: '蔬菜類', vendor: '產地直送', name: '高山高麗菜', code: 'V001', rawPrice: 45, unit: 'kg' },
  { category: '火鍋料與副餐', vendor: '知名大廠', name: '手工蛋餃', code: 'H001', rawPrice: 150, unit: '包' },
  { category: '海鮮類', vendor: '極鮮海產批發', name: '冷凍白蝦 (40/50)', code: 'S001', rawPrice: 280, unit: 'kg' },
];

const SAMPLE_RULES = {
  '無骨雞腿肉': { yieldRate: 85, calculationText: '進貨價 ÷ 淨肉率 (85%)', recipeUnit: 'g', recipeConversion: 1000 },
  '特級牛五花': { yieldRate: 90, calculationText: '進貨價 ÷ 淨肉率 (90%)', recipeUnit: 'g', recipeConversion: 1000 },
  '高山高麗菜': { yieldRate: 70, calculationText: '去外葉耗損 (70%)', recipeUnit: 'g', recipeConversion: 1000 },
  '手工蛋餃': { yieldRate: 100, calculationText: '無耗損 (一包約30個)', recipeUnit: '個', recipeConversion: 30 },
  '冷凍白蝦 (40/50)': { yieldRate: 50, calculationText: '進貨價 ÷ 剝殼去頭淨肉率 (50%)', recipeUnit: 'g', recipeConversion: 1000 }
};

// 預設系統介面文字 (供客製化)
const defaultUITexts = {
  loginTitle: 'Reset password',
  loginErrorNotLongEnough: 'Password not long enough',
  loginButton: 'Reset',
  loginCancel: 'Cancel',
  sidebarMenu: '主選單',
  tabMonthlyPrice: '每月售價',
  tabIngredients: '食材成本',
  tabSetMenus: '商品計算',
  tabSettings: '成本參數',
  tabSellingPrice: '售價金額',
  statusTitle: '系統狀態',
  statusText: '資料儲存於本機'
};

const defaultGlobalSettings = { taxRate: 5, systemName: 'FINERP', uiTexts: defaultUITexts };

const SAMPLE_SET_MENUS = [
  {
    id: 'sm1', name: '綜合大菜盤', sellingPrice: 180,
    categories: [
      {
        id: 'cat-1',
        name: '生鮮蔬菜',
        items: [
          { id: 'ig1', itemId: 'item-V001', itemCode: 'V001', itemName: '高山高麗菜', vendorName: '產地直送', qty: 150, unit: 'g' }
        ]
      },
      {
        id: 'cat-2',
        name: '精選火鍋料',
        items: [
          { id: 'ig2', itemId: 'item-H001', itemCode: 'H001', itemName: '手工蛋餃', vendorName: '知名大廠', qty: 2, unit: '個' }
        ]
      }
    ]
  }
];

// 食材成本 = 售價 ÷（重量 × 耗損）× (1 + 營業稅)
const calcCost = (price, weight, yieldPct, taxPct) => {
  if (!(price >= 0) || !(weight > 0) || !(yieldPct > 0) || !(taxPct >= 0)) return null;
  return price / (weight * (yieldPct / 100)) * (1 + taxPct / 100);
};

// 舊版「商品 → 分類 → 單品」結構：把每個分類原樣轉成獨立的分類卡片（只搬來自食材成本的單品）
const migrateRecipeCategories = (menus) => (Array.isArray(menus) ? menus : []).flatMap(m =>
  (m.categories || [])
    .filter(c => (c.items || []).some(i => i.costCalcId))
    .map(c => ({
      id: `cc-${newUid()}`,
      name: c.name || '未命名分類',
      items: c.items.filter(i => i.costCalcId).map(i => ({
        id: `ci-${newUid()}`, costCalcId: i.costCalcId, itemName: i.itemName, storeName: i.vendorName || '',
        recipeCost: i.recipeCost || 0, recipeUnit: i.recipeUnit, qty: i.qty
      }))
    })));

// 會自動長高的多行文字框：內容再長也能完整看到，不會被截斷
const AutoText = ({ value, onChange, className = '', ...rest }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('height', (el.scrollHeight + 2) + 'px', 'important');
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={onChange} className={`resize-none overflow-hidden ${className}`} {...rest} />;
};

const defaultUnits = ['g', 'kg', '台斤', '斤', '個', '片', '份', '包', 'ml', 'L'];

// 系統預設為空白，不再內建範例資料
const initialRawData = [];
const defaultRules = {};
const initialSetMenus = [];

export default function App() {
  const [initialSaved] = useState(loadSavedData);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const [isShaking, setIsShaking] = useState(false); 
  
  const [currentTab, setCurrentTab] = useState('ingredients'); 
  const [notice, setNotice] = useState(null);
  const [costCalcs, setCostCalcs] = useState(() => Array.isArray(initialSaved?.costCalcs) ? initialSaved.costCalcs : []);
  const [costPickId, setCostPickId] = useState(null);
  const [addingItem, setAddingItem] = useState(null);
  const [editingCat, setEditingCat] = useState(null); // { name, value }
  const [noteDraft, setNoteDraft] = useState('');
  const [fabOpen, setFabOpen] = useState(false); // 每月售價：右側懸浮「價格速查」
  const [fabStore, setFabStore] = useState('');
  const [fabSearch, setFabSearch] = useState('');
  const [fabOnlyTodo, setFabOnlyTodo] = useState(false);
  const [fabDrafts, setFabDrafts] = useState({});
  const [fabCollapsed, setFabCollapsed] = useState({});
  // 價格異動：批次調價 + 異動紀錄
  const [priceLog, setPriceLog] = useState(() => Array.isArray(initialSaved?.priceLog) ? initialSaved.priceLog : []);
  const [chgOpen, setChgOpen] = useState(false);
  const [chgStore, setChgStore] = useState('');
  const [chgSearch, setChgSearch] = useState('');
  const [chgDrafts, setChgDrafts] = useState({});
  const [chgCollapsed, setChgCollapsed] = useState({});
  const [chgHist, setChgHist] = useState({});
  const [chgView, setChgView] = useState('edit'); // 'edit' 填寫新價格 | 'log' 已異動商品
  const [chgLogOpen, setChgLogOpen] = useState({});
  const [detailItemId, setDetailItemId] = useState(null); // 商品計算：點單品名稱開啟的食材成本資料卡
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailForm, setDetailForm] = useState(null);
  const [recSearch, setRecSearch] = useState('');
  const [recCat, setRecCat] = useState('');
  const [collapsedCats, setCollapsedCats] = useState({});
  const [quickCat, setQuickCat] = useState(null); // 每月售價：展開的分類（快速選商品）
  const [calcEditing, setCalcEditing] = useState(false); // 已儲存的食材成本需按鉛筆才能修改
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // { id, text }
  const [notes, setNotes] = useState(() => Array.isArray(initialSaved?.notes) ? initialSaved.notes : []);
  const [costCategories, setCostCategories] = useState(() => Array.isArray(initialSaved?.costCategories) ? initialSaved.costCategories : migrateRecipeCategories(initialSaved?.setMenus));
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [units, setUnits] = useState(() => Array.isArray(initialSaved?.units) && initialSaved.units.length > 0 ? initialSaved.units : defaultUnits);
  const [unitPanel, setUnitPanel] = useState({ open: false, newName: '' });
  const [costMonthFilter, setCostMonthFilter] = useState('');
  const [costStoreFilter, setCostStoreFilter] = useState('');
  const [costCatFilter, setCostCatFilter] = useState('');
  const [costStatusFilter, setCostStatusFilter] = useState(''); // '' | 'todo' | 'done'
  const [costForm, setCostForm] = useState({ price: '', weight: '', weightUnit: 'g', yieldRate: '', yieldNote: '', taxRate: '' });
  const fileInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  
  const [settingsCategoryFilter, setSettingsCategoryFilter] = useState('全部');
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  
  const [rawErpData, setRawErpData] = useState(() => withUids(Array.isArray(initialSaved?.rawErpData) ? initialSaved.rawErpData : initialRawData));
  const [productRules, setProductRules] = useState(() => initialSaved?.productRules ?? defaultRules);
  const [globalSettings, setGlobalSettings] = useState(() => ({
    ...defaultGlobalSettings,
    ...(initialSaved?.globalSettings || {}),
    uiTexts: { ...defaultUITexts, ...(initialSaved?.globalSettings?.uiTexts || {}) }
  }));
  
  const [editingRules, setEditingRules] = useState({}); 
  const [editingGlobalSettings, setEditingGlobalSettings] = useState(defaultGlobalSettings);
  const [setMenus, setSetMenus] = useState(() => Array.isArray(initialSaved?.setMenus) ? initialSaved.setMenus : initialSetMenus);

  const [stores, setStores] = useState(() => Array.isArray(initialSaved?.stores) ? initialSaved.stores : []);
  const [monthlyPrices, setMonthlyPrices] = useState(() => Array.isArray(initialSaved?.monthlyPrices) ? initialSaved.monthlyPrices : []);
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [mpForm, setMpForm] = useState({ storeId: '', category: '', menuId: '', price: '' });
  const [newStoreName, setNewStoreName] = useState('');
  const [foodCostPercent, setFoodCostPercent] = useState(() => typeof initialSaved?.foodCostPercent === 'number' ? initialSaved.foodCostPercent : 33.33);
  const [isEditingUI, setIsEditingUI] = useState(false);
  const [tempUITexts, setTempUITexts] = useState(defaultUITexts);
  const [tempSystemName, setTempSystemName] = useState(defaultGlobalSettings.systemName);

  const texts = globalSettings.uiTexts || defaultUITexts;

  // ==========================================
  // 【資料動態計算器】
  // ==========================================
  const erpData = useMemo(() => {
    const grouped = {};
    rawErpData.forEach(item => {
       if (!grouped[item.category]) grouped[item.category] = {};
       if (!grouped[item.category][item.vendor]) grouped[item.category][item.vendor] = [];
       
       const rule = productRules[item.name] || { yieldRate: 100, calculationText: '進貨價 ÷ 100% (無耗損)', recipeUnit: item.unit, recipeConversion: 1 };
       const finalCost = item.rawPrice / (rule.yieldRate / 100);
       const rUnit = rule.recipeUnit || item.unit;
       const rConv = rule.recipeConversion || 1;
       const recipeCost = finalCost / rConv;
       
       grouped[item.category][item.vendor].push({
          id: `item-${item.code || item.vendor + '-' + item.name}`,
          uid: item.uid,
          code: item.code || '',
          name: item.name,
          rawPrice: item.rawPrice,
          unit: item.unit,
          yieldRate: `${rule.yieldRate}%`,
          calculation: rule.calculationText,
          finalCost: finalCost,
          recipeUnit: rUnit,
          recipeConversion: rConv,
          recipeCost: recipeCost
       });
    });

    return Object.keys(grouped).map((catName, index) => ({
       id: `cat-${index}`,
       category: catName,
       icon: getIconByCategory(catName),
       color: getColorByCategory(catName),
       vendors: Object.keys(grouped[catName]).map(vName => ({
          vendorName: vName,
          items: grouped[catName][vName]
       }))
    }));
  }, [rawErpData, productRules]);

  const allAvailableIngredients = useMemo(() => {
    return erpData.flatMap(cat => cat.vendors.flatMap(v => v.items.map(item => ({ ...item, categoryName: cat.category, vendorName: v.vendorName }))));
  }, [erpData]);

  // 跨系統比對：代號優先 → 名稱+廠商 → 僅名稱 → 原始資料
  const findIngredient = (ig) => {
    if (ig.costCalcId) {
      const calc = costCalcs.find(c => c.id === ig.costCalcId);
      const live = calc ? calcCost(calc.price, calc.weight, calc.yieldRate, calc.taxRate) : null;
      // 食材成本有更新就跟著更新；若該筆已被刪除，沿用當初加入時的成本
      if (live !== null) return { ...ig, recipeCost: live, finalCost: live, recipeUnit: calc.weightUnit, unit: calc.weightUnit, vendorName: calc.storeName, itemName: calc.menuName };
      return ig;
    }
    return (ig.itemCode && allAvailableIngredients.find(a => a.code && a.code === ig.itemCode))
      || allAvailableIngredients.find(a => a.name === ig.itemName && a.vendorName === ig.vendorName)
      || allAvailableIngredients.find(a => a.name === ig.itemName)
      || ig;
  };

  const uniqueProductsForSettings = useMemo(() => {
    const map = new Map();
    rawErpData.forEach(item => {
      if (!map.has(item.name)) {
        map.set(item.name, item);
      }
    });
    return Array.from(map.values());
  }, [rawErpData]);

  const availableCategories = useMemo(() => {
    const cats = new Set(uniqueProductsForSettings.map(item => item.category));
    return ['全部', ...Array.from(cats)];
  }, [uniqueProductsForSettings]);

  const filteredSettingsProducts = useMemo(() => {
    return uniqueProductsForSettings.filter(item => {
      const matchCat = settingsCategoryFilter === '全部' || item.category === settingsCategoryFilter;
      const matchSearch = item.name.toLowerCase().includes(settingsSearchQuery.toLowerCase()) || (item.code && item.code.toLowerCase().includes(settingsSearchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [uniqueProductsForSettings, settingsCategoryFilter, settingsSearchQuery]);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (pin === '1021' || pin === '0204') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
      setPin('');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500); 
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      setTimeout(() => handleLogin(), 150); 
    }
  }, [pin]);

  useEffect(() => {
    if (currentTab === 'settings') {
      setEditingRules(productRules);
      setEditingGlobalSettings(globalSettings);
    }
  }, [currentTab, productRules, globalSettings]);

  // ==========================================
  // 本機儲存、提示訊息
  // ==========================================
  // 防呆確認視窗：刪除前一律先跳出，預設焦點在「取消」
  const [confirmDlg, setConfirmDlg] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');
  const askConfirm = (opts) => { setConfirmInput(''); setConfirmDlg(opts); };
  const closeConfirm = () => setConfirmDlg(null);

  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  // 資料有變動時自動存入瀏覽器
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1, samplesRemoved: true, rawErpData, productRules, globalSettings, setMenus, foodCostPercent, stores, monthlyPrices, costCalcs, units, costCategories, notes, priceLog
      }));
    } catch (e) {
      console.error('本機儲存失敗:', e);
      showNotice('error', '儲存失敗：瀏覽器儲存空間不足或已停用。');
    }
  }, [rawErpData, productRules, globalSettings, setMenus, foodCostPercent, stores, monthlyPrices, costCalcs, units, costCategories, notes, priceLog]);

  const saveSettings = () => {
    setProductRules(editingRules);
    setGlobalSettings(editingGlobalSettings);
    showNotice('success', '參數儲存成功！');
    setCurrentTab('ingredients');
  };

  // ==========================================
  // 備份 / 匯入 / 還原
  // ==========================================
  const handleExport = () => {
    const data = {
      app: 'cost-management-system', version: 1, exportedAt: new Date().toISOString(),
      rawErpData, productRules, globalSettings, setMenus, foodCostPercent, stores, monthlyPrices, costCalcs, units, costCategories, notes, priceLog
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotice('success', '備份檔已匯出。');
  };

  const handleImport = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.rawErpData)) throw new Error('格式不符');
        askConfirm({ title: '匯入並覆蓋資料？', message: '匯入會覆蓋目前所有資料。', confirmText: '確定匯入', onConfirm: () => {
        setRawErpData(withUids(data.rawErpData));
        setProductRules(data.productRules || {});
        setGlobalSettings({
          ...defaultGlobalSettings,
          ...(data.globalSettings || {}),
          uiTexts: { ...defaultUITexts, ...(data.globalSettings?.uiTexts || {}) }
        });
        setSetMenus(Array.isArray(data.setMenus) ? data.setMenus : []);
        setFoodCostPercent(typeof data.foodCostPercent === 'number' ? data.foodCostPercent : 33.33);
        setStores(Array.isArray(data.stores) ? data.stores : []);
        setMonthlyPrices(Array.isArray(data.monthlyPrices) ? data.monthlyPrices : []);
        setCostCalcs(Array.isArray(data.costCalcs) ? data.costCalcs : []);
        setUnits(Array.isArray(data.units) && data.units.length > 0 ? data.units : defaultUnits);
        setCostCategories(Array.isArray(data.costCategories) ? data.costCategories : migrateRecipeCategories(data.setMenus));
        setNotes(Array.isArray(data.notes) ? data.notes : []);
        setPriceLog(Array.isArray(data.priceLog) ? data.priceLog : []);
        setOpenCategoryId(null);
        setCostPickId(null);
        showNotice('success', '備份匯入成功！');
        } });
      } catch (err) {
        console.error(err);
        showNotice('error', '匯入失敗：檔案格式不正確。');
      }
    };
    reader.readAsText(file);
  };

  const handleResetAll = () => askConfirm({ title: '清空所有資料？', message: '這會清除所有食材、規則、商品配方、門店與售價紀錄。\n建議先匯出備份。', requireText: '刪除', confirmText: '清空全部', onConfirm: doResetAll });
  const doResetAll = () => {
    setRawErpData(withUids(initialRawData));
    setProductRules(defaultRules);
    setGlobalSettings(defaultGlobalSettings);
    setSetMenus(initialSetMenus);
    setFoodCostPercent(33.33);
    setStores([]);
    setMonthlyPrices([]);
    setCostCalcs([]);
    setUnits(defaultUnits);
    setCostCategories([]);
    setNotes([]);
    setPriceLog([]);
    setChgDrafts({});
    setNoteDraft('');
    setEditingNote(null);
    setOpenCategoryId(null);
    setCostPickId(null);
    setMpForm({ storeId: '', category: '', menuId: '', price: '' });
    setEditingRules(defaultRules);
    setEditingGlobalSettings(defaultGlobalSettings);
    showNotice('success', '已清空所有資料。');
  };

  const openUIEditor = () => {
    setTempUITexts(globalSettings.uiTexts || defaultUITexts);
    setTempSystemName(globalSettings.systemName || 'FINERP');
    setIsEditingUI(true);
  };

  const saveUITexts = () => {
    const newSettings = { ...globalSettings, uiTexts: tempUITexts, systemName: tempSystemName };
    setGlobalSettings(newSettings);
    setIsEditingUI(false);
  };

  const handleRuleChange = (productName, field, value) => {
    setEditingRules(prev => {
       const existingRule = prev[productName] || { yieldRate: 100, calculationText: '進貨價 ÷ 100% (無耗損)', recipeUnit: '', recipeConversion: 1 };
       return { ...prev, [productName]: { ...existingRule, [field]: value } };
    });
  };

  const handleCodeChange = (itemName, vendorName, newCode) => {
    setRawErpData(prev => prev.map(item => 
      (item.name === itemName && item.vendor === vendorName) ? { ...item, code: newCode } : item
    ));
  };

  const renderUIEditor = () => {
    if (!isEditingUI) return null;
    
    const renderInputField = (label, valueKey) => (
      <div key={valueKey}>
        <label className="block text-xs font-bold text-[#5F5F68] mb-2 tracking-widest uppercase">{label}</label>
        <input 
          type="text" value={tempUITexts[valueKey] || ''}
          onChange={(e) => setTempUITexts({...tempUITexts, [valueKey]: e.target.value})}
          className="w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all"
        />
      </div>
    );

    return (
      <div className="fixed inset-0 z-[100] bg-[#F5F5F5] flex flex-col animate-in fade-in duration-300 overflow-y-auto selection:bg-neutral-200">
        <div className="bg-white border-b border-neutral-100 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsEditingUI(false)} className="w-10 h-10 flex items-center justify-center bg-[#F5F5F5] rounded-full text-black hover:bg-neutral-200 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-xl font-black text-black tracking-tight">自訂系統文字</h2>
          </div>
          <button onClick={saveUITexts} className="bg-black hover:bg-neutral-800 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-[0_10px_20px_rgba(0,0,0,0.08)] transition-all">
            儲存變更
          </button>
        </div>

        <div className="max-w-3xl mx-auto w-full p-6 py-8 space-y-8">
          <section className="bg-[#DEDEE4] p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE]">
             <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
               <div className="p-2 bg-[#F5F5F5] rounded-full"><Lock size={18} className="text-black"/></div>
               登入畫面文字
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {renderInputField("大標題", "loginTitle")}
               {renderInputField("長度不足錯誤文字", "loginErrorNotLongEnough")}
               {renderInputField("登入按鈕文字", "loginButton")}
               {renderInputField("底部取消按鈕", "loginCancel")}
             </div>
          </section>
          
          <section className="bg-[#DEDEE4] p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE]">
             <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
               <div className="p-2 bg-[#F5F5F5] rounded-full"><Type size={18} className="text-black"/></div>
               導覽列與介面文字
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label className="block text-xs font-bold text-[#5F5F68] mb-2 tracking-widest uppercase">系統名稱 (LOGO)</label>
                 <input 
                   type="text" value={tempSystemName}
                   onChange={(e) => setTempSystemName(e.target.value)}
                   className="w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all"
                 />
               </div>
               {renderInputField("側邊欄群組標題", "sidebarMenu")}
               {renderInputField("每月售價 分頁名稱", "tabMonthlyPrice")}
               {renderInputField("分頁 1 名稱", "tabIngredients")}
               {renderInputField("分頁 2 名稱", "tabSetMenus")}
               {renderInputField("分頁 3 名稱", "tabSellingPrice")}
               {renderInputField("分頁 4 名稱", "tabSettings")}
               {renderInputField("狀態欄標題", "statusTitle")}
               {renderInputField("狀態欄提示字", "statusText")}
             </div>
          </section>
        </div>
      </div>
    );
  };

  const renderPriceFab = () => {
    if (currentTab !== 'monthlyPrice') return null;
    const storeId = stores.some(st => st.id === fabStore) ? fabStore : (stores[0] ? stores[0].id : '');
    const catOfM = (m) => m.menuCategory || '未分類';
    const liveMenus = setMenus.filter(m => monthlyPrices.some(r => r.menuId === m.id));
    const [yy, mm] = selectedMonth.split('-');
    const shiftMonth = (d) => { const dt = new Date(parseInt(yy, 10), parseInt(mm, 10) - 1 + d, 1); setSelectedMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); setFabDrafts({}); };
    const recOf = (m) => monthlyPrices.find(r => r.month === selectedMonth && r.storeId === storeId && r.menuId === m.id);
    const lastOf = (m) => monthlyPrices.filter(r => r.menuId === m.id && r.storeId === storeId && r.month < selectedMonth).sort((a, b) => b.month.localeCompare(a.month))[0];
    const q = fabSearch.trim().toLowerCase();
    const shown = liveMenus.filter(m => (!q || m.name.toLowerCase().includes(q) || catOfM(m).toLowerCase().includes(q)) && (!fabOnlyTodo || !recOf(m)));
    const groups = []; shown.slice().sort((a, b) => catOfM(a).localeCompare(catOfM(b), 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant')).forEach(m => { const c = catOfM(m); const g = groups.find(x => x[0] === c); if (g) g[1].push(m); else groups.push([c, [m]]); });
    const registered = liveMenus.filter(m => recOf(m)).length;
    const commit = (m, raw) => {
      setFabDrafts(prev => { const n = { ...prev }; delete n[m.id]; return n; });
      if (raw === undefined || raw === '') return;
      const price = parseFloat(raw);
      if (isNaN(price) || price < 0) { showNotice('error', '請輸入正確的售價。'); return; }
      const rec = recOf(m);
      if (rec) { if (rec.price === price) return; setMonthlyPrices(prev => prev.map(r => r.id === rec.id ? { ...r, price } : r)); }
      else setMonthlyPrices(prev => [...prev, { id: newUid(), month: selectedMonth, storeId, menuId: m.id, menuName: m.name, category: catOfM(m), price }]);
    };
    return (
      <>
        {fabOpen && (
          <div role="dialog" aria-label="價格速查" className="fixed z-[130] right-3 md:right-6 top-16 bottom-40 md:bottom-24 w-[min(460px,calc(100vw-1.5rem))] flex flex-col bg-white rounded-[28px] border border-[#B4B4BE] shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-left overflow-hidden">
            <div className="p-5 pb-3 border-b border-[#D4D4DC] bg-[#DEDEE4]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-black text-lg text-black flex items-center gap-2"><Receipt size={18} /> 價格速查</h3>
                <button onClick={() => setFabOpen(false)} aria-label="關閉價格速查" className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-neutral-200 transition-colors"><X size={15} /></button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => shiftMonth(-1)} aria-label="上一個月" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#B4B4BE] hover:border-black"><ChevronLeft size={16} /></button>
                <span className="flex-1 text-center font-black text-black text-sm">{yy} 年 {parseInt(mm, 10)} 月</span>
                <button onClick={() => shiftMonth(1)} aria-label="下一個月" className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#B4B4BE] hover:border-black"><ChevronRight size={16} /></button>
                <select value={storeId} onChange={(e) => { setFabStore(e.target.value); setFabDrafts({}); }} aria-label="速查門店" className="bg-white border border-[#B4B4BE] rounded-full px-3 py-2 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-black max-w-[120px]">
                  {stores.length === 0 && <option value="">無門店</option>}
                  {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input value={fabSearch} onChange={(e) => setFabSearch(e.target.value)} placeholder="搜尋商品或分類…" aria-label="速查搜尋" className="w-full bg-white border border-[#B4B4BE] rounded-full pl-9 pr-4 py-2 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-black" />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs font-bold text-[#5F5F68]">本月已登錄 {registered} / {liveMenus.length}</span>
                <button onClick={() => setFabOnlyTodo(!fabOnlyTodo)} aria-pressed={fabOnlyTodo} className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${fabOnlyTodo ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-300 hover:border-red-500'}`}>只看本月未登錄</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {!storeId ? <p className="text-red-600 font-bold text-sm text-center py-10">請先在頁面上方新增門店。</p>
              : groups.length === 0 ? <p className="text-red-600 font-bold text-sm text-center py-10">{liveMenus.length === 0 ? '還沒有已登錄的商品。' : '找不到符合的商品。'}</p>
              : groups.map(([cat, list]) => {
                const open = q ? true : !fabCollapsed[cat];
                return (
                  <div key={cat} className="mb-3">
                    <button onClick={() => setFabCollapsed({ ...fabCollapsed, [cat]: !fabCollapsed[cat] })} className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] bg-[#EFEFF3] hover:bg-[#E6E6EC] font-black text-sm text-black transition-colors">
                      <ChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />{cat}<span className="text-xs font-bold text-[#5F5F68]">{list.length} 項</span>
                    </button>
                    {open && list.map(m => {
                      const rec = recOf(m); const last = lastOf(m);
                      const draft = fabDrafts[m.id];
                      const val = draft !== undefined ? draft : (rec ? rec.price : '');
                      const cur = parseFloat(val); const base = last ? parseFloat(last.price) : NaN;
                      const pct = !isNaN(cur) && !isNaN(base) && base > 0 ? ((cur - base) / base) * 100 : null;
                      return (
                        <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-neutral-100">
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-black text-base truncate">{m.name}</p>
                            <p className="text-[11px] font-bold text-[#5F5F68]">{last ? `上次 $${last.price}（${parseInt(last.month.slice(5), 10)} 月）` : '無歷史價格'}</p>
                          </div>
                          {pct !== null && pct !== 0 && <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${pct > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>}
                          <div className="flex items-center bg-[#F5F5F5] rounded-full pl-3 focus-within:ring-2 focus-within:ring-black">
                            <span className="text-[#5F5F68] font-bold text-sm">$</span>
                            <input type="number" min="0" step="any" value={val} placeholder="未登錄" aria-label={`${m.name} 本月售價`}
                              onChange={(e) => setFabDrafts({ ...fabDrafts, [m.id]: e.target.value })}
                              onBlur={(e) => commit(m, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              className={`w-20 bg-transparent px-2 py-2 text-right font-black text-sm outline-none ${rec ? 'text-black' : 'text-red-600 placeholder:text-red-400'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="px-5 py-2.5 text-[11px] font-bold text-red-600 border-t border-[#D4D4DC]">輸入售價後按 Enter 或點其他地方即自動儲存。</p>
          </div>
        )}
        <button onClick={() => setFabOpen(!fabOpen)} aria-label="價格速查" aria-expanded={fabOpen} className="fixed z-[140] right-3 md:right-6 bottom-24 md:bottom-8 flex items-center gap-2 bg-black hover:bg-neutral-800 text-white pl-4 pr-5 py-3.5 rounded-full font-bold text-sm shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 transition-all">
          {fabOpen ? <X size={18} /> : <Receipt size={18} />} {fabOpen ? '收合' : '價格速查'}
        </button>
      </>
    );
  };

  const renderPriceChange = () => {
    if (currentTab !== 'monthlyPrice') return null;
    const storeId = stores.some(st => st.id === chgStore) ? chgStore : (stores[0] ? stores[0].id : '');
    const storeName = (stores.find(st => st.id === storeId) || {}).name || '';
    const catOfM = (m) => m.menuCategory || '未分類';
    const liveMenus = setMenus.filter(m => monthlyPrices.some(r => r.menuId === m.id));
    const d0 = new Date();
    const todayMonth = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`;
    const fmtDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; };
    const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
    const latestOf = (m) => monthlyPrices.filter(r => r.menuId === m.id && r.storeId === storeId).sort((a, b) => b.month.localeCompare(a.month))[0];
    const logOf = (m) => priceLog.filter(l => l.menuId === m.id && l.storeId === storeId).sort((a, b) => b.at - a.at);
    const q = chgSearch.trim().toLowerCase();
    const shown = liveMenus.filter(m => !q || m.name.toLowerCase().includes(q) || catOfM(m).toLowerCase().includes(q));
    const groups = [];
    shown.slice().sort((a, b) => catOfM(a).localeCompare(catOfM(b), 'zh-Hant') || a.name.localeCompare(b.name, 'zh-Hant')).forEach(m => { const c = catOfM(m); const g = groups.find(x => x[0] === c); if (g) g[1].push(m); else groups.push([c, [m]]); });
    const filled = liveMenus.filter(m => chgDrafts[m.id] !== undefined && String(chgDrafts[m.id]).trim() !== '');
    const closeChg = () => { setChgOpen(false); setChgDrafts({}); setChgView('edit'); };
    const logGroups = (() => {
      const map = {};
      priceLog.forEach(l => { const k = `${l.menuId}|${l.storeId}`; (map[k] = map[k] || { key: k, name: l.menuName, category: l.category || '未分類', storeName: l.storeName, list: [] }).list.push(l); });
      return Object.values(map).map(g => ({ ...g, list: g.list.sort((a, b) => b.at - a.at) }))
        .filter(g => !q || g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || (g.storeName || '').toLowerCase().includes(q))
        .sort((a, b) => b.list[0].at - a.list[0].at);
    })();
    const expandAll = () => { if (chgView === 'log') { const o = {}; logGroups.forEach(g => { o[g.key] = true; }); setChgLogOpen(o); } else setChgCollapsed({}); };
    const collapseAll = () => { if (chgView === 'log') setChgLogOpen({}); else { const o = {}; liveMenus.forEach(m => { o[catOfM(m)] = true; }); setChgCollapsed(o); } };
    const apply = () => {
      const changes = [];
      for (const m of filled) {
        const price = parseFloat(chgDrafts[m.id]);
        if (isNaN(price) || price < 0) { showNotice('error', `「${m.name}」的價格不正確。`); return; }
        const cur = latestOf(m);
        if (cur && cur.price === price) continue;
        changes.push({ m, price, cur });
      }
      if (changes.length === 0) { showNotice('error', '沒有需要異動的價格（未填寫或與目前價格相同）。'); return; }
      const now = Date.now();
      let prices = [...monthlyPrices]; let calcs = [...costCalcs]; let cats = costCategories; const logs = []; let synced = 0;
      for (const { m, price, cur } of changes) {
        let rec = prices.find(r => r.month === todayMonth && r.storeId === storeId && r.menuId === m.id);
        if (rec) { const id = rec.id; prices = prices.map(r => r.id === id ? { ...r, price } : r); }
        else { rec = { id: newUid(), month: todayMonth, storeId, menuId: m.id, menuName: m.name, category: catOfM(m), price }; prices.push(rec); }
        logs.push({ id: newUid(), menuId: m.id, menuName: m.name, category: catOfM(m), storeId, storeName, month: todayMonth, oldPrice: cur ? cur.price : null, newPrice: price, at: now });
        // 同步「食材成本」
        const hit = calcs.find(c => c.recordId === rec.id);
        if (hit) { calcs = calcs.map(c => c.id === hit.id ? { ...c, price } : c); synced++; }
        else {
          const monthOf = (c) => { const r = prices.find(x => x.id === c.recordId); return r ? r.month : (c.month || ''); };
          const olds = calcs.filter(c => { const r = prices.find(x => x.id === c.recordId); return r ? (r.menuId === m.id && r.storeId === storeId) : (c.menuName === m.name && (c.category || '未分類') === catOfM(m) && c.storeName === storeName); }).sort((a, b) => monthOf(b).localeCompare(monthOf(a)));
          const old = olds[0];
          if (old) {
            const nc = { ...old, id: newUid(), recordId: rec.id, month: todayMonth, price, menuName: m.name, category: catOfM(m), storeName };
            calcs.push(nc); synced++;
            cats = cats.map(c => ({ ...c, items: (c.items || []).map(i => i.costCalcId === old.id ? { ...i, costCalcId: nc.id } : i) }));
          }
        }
      }
      setMonthlyPrices(prices); setCostCalcs(calcs); setCostCategories(cats); setPriceLog(prev => [...logs, ...prev]);
      setChgDrafts({}); setChgOpen(false);
      showNotice('success', `已更新 ${changes.length} 項價格異動，並同步 ${synced} 項食材成本。`);
    };
    return (
      <>
        {chgOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 md:p-6 bg-black/50" onClick={closeChg}>
            <div role="dialog" aria-label="價格異動" onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-[28px] border border-[#B4B4BE] shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden">
              <div className="p-5 pb-4 border-b border-[#D4D4DC] bg-orange-50">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-black text-xl text-black flex items-center gap-2"><TrendingUp size={20} className="text-orange-600" /> 價格異動</h3>
                  <div className="flex items-center gap-1.5">
                    <button onClick={expandAll} className="px-3 py-1.5 rounded-full bg-white border border-[#B4B4BE] hover:border-black text-xs font-bold text-black whitespace-nowrap">全部展開</button>
                    <button onClick={collapseAll} className="px-3 py-1.5 rounded-full bg-white border border-[#B4B4BE] hover:border-black text-xs font-bold text-black whitespace-nowrap">全部收合</button>
                    <button onClick={closeChg} aria-label="關閉價格異動" className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-neutral-200 transition-colors"><X size={16} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setChgView(chgView === 'log' ? 'edit' : 'log')} aria-pressed={chgView === 'log'} className={`px-4 py-2 rounded-full text-sm font-black border transition-colors ${chgView === 'log' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-orange-500 text-orange-600 hover:bg-orange-50'}`}>{chgView === 'log' ? '← 返回填寫' : `異動價格（${logGroups.length}）`}</button>
                  {chgView !== 'log' && <select value={storeId} onChange={(e) => { setChgStore(e.target.value); setChgDrafts({}); }} aria-label="異動門店" className="bg-white border border-[#B4B4BE] rounded-full px-4 py-2 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-black">
                    {stores.length === 0 && <option value="">無門店</option>}
                    {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>}
                  <div className="relative flex-1 min-w-[160px]">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input value={chgSearch} onChange={(e) => setChgSearch(e.target.value)} placeholder="搜尋商品或分類…" aria-label="異動搜尋" className="w-full bg-white border border-[#B4B4BE] rounded-full pl-9 pr-4 py-2 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-black" />
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold text-red-600">{chgView === 'log' ? '以下是曾經異動過價格的商品，最近異動的排在最前面。' : '只需填寫有調整的商品，沒填的不會異動。'}{chgView !== 'log' && `生效日期：${fmtDate(Date.now())}（${parseInt(todayMonth.slice(5), 10)} 月）。`}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
                {chgView === 'log' ? (
                  logGroups.length === 0 ? <p className="text-red-600 font-bold text-sm text-center py-10">{priceLog.length === 0 ? '還沒有任何價格異動紀錄。' : '找不到符合的商品。'}</p>
                  : <div className="space-y-3">{logGroups.map(g => {
                    const open = q ? true : !!chgLogOpen[g.key]; const last = g.list[0];
                    const pctOf = (l) => (l.oldPrice > 0 ? ((l.newPrice - l.oldPrice) / l.oldPrice) * 100 : null);
                    const Badge = ({ l }) => { const pc = pctOf(l); return pc === null || pc === 0 ? null : <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${pc > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{pc > 0 ? '▲' : '▼'} {Math.abs(pc).toFixed(1)}%</span>; };
                    return (
                      <div key={g.key} className="rounded-[20px] border border-[#B4B4BE] bg-white overflow-hidden">
                        <button onClick={() => setChgLogOpen({ ...chgLogOpen, [g.key]: !chgLogOpen[g.key] })} aria-expanded={open} className="w-full text-left p-4 flex items-start gap-3 hover:bg-neutral-50">
                          <ChevronDown size={16} className={`mt-1 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-black text-base break-words">{g.name}</p>
                            <p className="text-[11px] font-bold text-[#5F5F68] mt-0.5">{g.category}・{g.storeName}・共 {g.list.length} 次異動</p>
                            <p className="text-sm font-black text-black mt-1.5">{last.oldPrice === null ? '首次' : `$${fmtNum(last.oldPrice)}`} → <span className="text-orange-600">${fmtNum(last.newPrice)}</span> <span className="text-[11px] font-bold text-[#5F5F68] ml-1">{fmtDate(last.at)}</span></p>
                          </div>
                          <Badge l={last} />
                        </button>
                        {open && <ul className="border-t border-neutral-100 px-4 py-2 space-y-1.5 bg-[#FAFAFB]">
                          {g.list.map(l => <li key={l.id} className="flex items-center justify-between gap-2 text-xs font-bold text-black"><span>{fmtDate(l.at)}</span><span className="flex items-center gap-2">{l.oldPrice === null ? '首次' : `$${fmtNum(l.oldPrice)}`} → ${fmtNum(l.newPrice)} <Badge l={l} /></span></li>)}
                        </ul>}
                      </div>
                    );
                  })}</div>
                ) : !storeId ? <p className="text-red-600 font-bold text-sm text-center py-10">請先在頁面上方新增門店。</p>
                : groups.length === 0 ? <p className="text-red-600 font-bold text-sm text-center py-10">{liveMenus.length === 0 ? '還沒有已登錄的商品。' : '找不到符合的商品。'}</p>
                : groups.map(([cat, list]) => {
                  const open = q ? true : !chgCollapsed[cat];
                  return (
                    <div key={cat} className="mb-4">
                      <button onClick={() => setChgCollapsed({ ...chgCollapsed, [cat]: !chgCollapsed[cat] })} className="w-full flex items-center gap-2 px-3 py-2 rounded-[14px] bg-[#EFEFF3] hover:bg-[#E6E6EC] font-black text-sm text-black transition-colors">
                        <ChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />{cat}<span className="text-xs font-bold text-[#5F5F68]">{list.length} 項</span>
                      </button>
                      {open && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          {list.map(m => {
                            const cur = latestOf(m); const hist = logOf(m); const last = hist[0];
                            const val = chgDrafts[m.id] !== undefined ? chgDrafts[m.id] : '';
                            const nv = parseFloat(val); const pct = !isNaN(nv) && cur && cur.price > 0 ? ((nv - cur.price) / cur.price) * 100 : null;
                            const histOpen = !!chgHist[m.id];
                            return (
                              <div key={m.id} className={`rounded-[20px] border p-3.5 bg-white ${String(val).trim() !== '' ? 'border-orange-500 shadow-[0_0_0_2px_#F97316]' : 'border-[#B4B4BE]'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-black text-black text-base leading-snug break-words min-w-0">{m.name}</p>
                                  {pct !== null && pct !== 0 && <span className={`shrink-0 text-[11px] font-black px-2 py-0.5 rounded-full ${pct > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>}
                                </div>
                                <p className="text-xs font-bold text-[#5F5F68] mt-1">目前價格：{cur ? `$${fmtNum(cur.price)}（${parseInt(cur.month.slice(5), 10)} 月）` : '尚未登錄'}</p>
                                <div className="flex items-center bg-[#F5F5F5] rounded-full pl-4 mt-2.5 focus-within:ring-2 focus-within:ring-orange-500">
                                  <span className="text-[#5F5F68] font-bold text-sm">$</span>
                                  <input type="number" min="0" step="any" value={val} placeholder="填入新價格" aria-label={`${m.name} 新價格`}
                                    onChange={(e) => setChgDrafts({ ...chgDrafts, [m.id]: e.target.value })}
                                    className="flex-1 min-w-0 bg-transparent px-2 py-2.5 text-right font-black text-base text-black outline-none placeholder:text-neutral-400 placeholder:font-bold" />
                                  {String(val).trim() !== '' && <button onClick={() => { const n = { ...chgDrafts }; delete n[m.id]; setChgDrafts(n); }} aria-label={`清除 ${m.name} 新價格`} className="w-8 h-8 mr-1 flex items-center justify-center rounded-full hover:bg-neutral-200 text-neutral-500"><X size={14} /></button>}
                                </div>
                                {last ? (
                                  <button onClick={() => setChgHist({ ...chgHist, [m.id]: !histOpen })} aria-expanded={histOpen} className="mt-2 text-[11px] font-bold text-[#5F5F68] hover:text-black underline-offset-2 hover:underline text-left">
                                    上次異動 {fmtDate(last.at)}：{last.oldPrice === null ? '首次' : `$${fmtNum(last.oldPrice)}`} → ${fmtNum(last.newPrice)}　{histOpen ? '收合紀錄 ▲' : `全部紀錄（${hist.length}）▼`}
                                  </button>
                                ) : <p className="mt-2 text-[11px] font-bold text-[#8A8A94]">尚無異動紀錄</p>}
                                {histOpen && (
                                  <ul className="mt-1.5 space-y-1 border-t border-neutral-100 pt-1.5">
                                    {hist.map(l => <li key={l.id} className="text-[11px] font-bold text-black flex justify-between gap-2"><span>{fmtDate(l.at)}</span><span>{l.oldPrice === null ? '首次' : `$${fmtNum(l.oldPrice)}`} → ${fmtNum(l.newPrice)}</span></li>)}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-4 border-t border-[#D4D4DC] flex items-center justify-between gap-3 bg-white">
                {chgView === 'log' ? <span className="text-sm font-bold text-black">共 <span className="text-orange-600 font-black">{logGroups.length}</span> 項商品有異動</span> : <span className="text-sm font-bold text-black">已填寫 <span className="text-orange-600 font-black">{filled.length}</span> 項</span>}
                {chgView === 'log' ? <button onClick={closeChg} className="px-6 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white font-bold text-sm">關閉</button> : <div className="flex items-center gap-2">
                  <button onClick={closeChg} className="px-5 py-2.5 rounded-full bg-[#F5F5F5] hover:bg-neutral-200 font-bold text-sm text-black">取消</button>
                  <button onClick={apply} disabled={filled.length === 0} className="px-6 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed">確認異動</button>
                </div>}
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setChgOpen(true)} aria-label="價格異動" className="fixed z-[140] right-3 md:right-6 bottom-[9.5rem] md:bottom-[5.5rem] flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white pl-4 pr-5 py-3.5 rounded-full font-black text-sm shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors">
          <TrendingUp size={18} /> 價格異動
        </button>
      </>
    );
  };

  const renderCostDetailModal = () => {
    if (!detailItemId) return null;
    let item = null, cat = null;
    for (const c of costCategories) { const f = (c.items || []).find(i => i.id === detailItemId); if (f) { item = f; cat = c; break; } }
    if (!item) return null;
    const calc = costCalcs.find(c => c.id === item.costCalcId);
    const close = () => { setDetailItemId(null); setDetailEditing(false); setDetailForm(null); };
    const fmtUC = (v) => (v < 1 ? v.toFixed(4) : v.toFixed(2));
    const f = detailEditing && detailForm ? detailForm : calc;
    const num = (v) => (v === '' || v === undefined || v === null ? NaN : parseFloat(v));
    const unitCost = calc ? calcCost(num(f.price), num(f.weight), num(f.yieldRate), num(f.taxRate)) : null;
    const qty = parseFloat(item.qty) || 0;
    const startEdit = () => { setDetailForm({ price: calc.price, weight: calc.weight, weightUnit: calc.weightUnit, yieldRate: calc.yieldRate, yieldNote: calc.yieldNote || '', taxRate: calc.taxRate }); setDetailEditing(true); };
    const save = () => {
      if (unitCost === null) { showNotice('error', '請完整輸入售價、重量、可用重量與營業稅（重量與可用重量需大於 0）。'); return; }
      setCostCalcs(prev => prev.map(c => c.id === calc.id ? { ...c, price: num(detailForm.price), weight: num(detailForm.weight), weightUnit: detailForm.weightUnit, yieldRate: num(detailForm.yieldRate), yieldNote: detailForm.yieldNote, taxRate: num(detailForm.taxRate) } : c));
      setDetailEditing(false); setDetailForm(null);
      showNotice('success', `已更新「${calc.menuName}」的食材成本。`);
    };
    const setF = (k, v) => setDetailForm({ ...detailForm, [k]: v });
    const ro = !detailEditing;
    const fld = 'w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold h-[52px] disabled:bg-[#ECECF0] disabled:text-neutral-600 disabled:cursor-not-allowed';
    const lbl = 'block text-xs font-bold text-[#5F5F68] mb-2 tracking-widest uppercase text-left';
    const unitList = calc ? (units.includes(f.weightUnit) ? units : [f.weightUnit, ...units]) : [];
    return (
      <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/50" onClick={close} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
        <div role="dialog" aria-modal="true" aria-label="食材成本資料" className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-[28px] p-6 md:p-8 border border-[#B4B4BE] shadow-[0_20px_60px_rgba(0,0,0,0.35)] text-left" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <h3 className="text-2xl font-black text-black tracking-tight truncate">{calc ? calc.menuName : item.itemName}</h3>
              <p className="text-xs font-bold text-[#5F5F68] mt-1">{calc ? `${calc.storeName} · ${calc.month.slice(0, 4)} 年 ${parseInt(calc.month.slice(5), 10)} 月` : item.storeName}・分類「{cat.name}」</p>
            </div>
            <button onClick={close} aria-label="關閉" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#F5F5F5] hover:bg-neutral-200 transition-colors"><X size={16} /></button>
          </div>
          {!calc ? (
            <div className="mt-5">
              <p className="text-sm font-bold text-red-600 mb-3">此單品的食材成本來源已被刪除，目前沿用原本儲存的成本：${fmtUC(item.recipeCost || 0)}/{item.recipeUnit}。</p>
              <p className="text-xs font-bold text-[#5F5F68]">請先到「{texts.tabIngredients}」重新試算，再重新加入此單品。</p>
            </div>
          ) : (
            <>
              {ro
                ? <p className="text-xs font-bold text-red-600 mt-4 mb-4">目前為檢視模式，如需修改請按下方「編輯」（鉛筆）。</p>
                : <p className="text-xs font-bold text-red-600 mt-4 mb-4">修改後會同步更新「{texts.tabIngredients}」，以及所有使用此成本的單品。</p>}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={lbl}>售價 ($)</label><input type="number" min="0" step="any" disabled={ro} value={f.price} onChange={(e) => setF('price', e.target.value)} className={fld} aria-label="售價" /></div>
                <div><label className={lbl}>單位</label>
                  <select disabled={ro} value={f.weightUnit} onChange={(e) => setF('weightUnit', e.target.value)} className={fld} aria-label="單位">{unitList.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
                <div><label className={lbl}>重量</label><input type="number" min="0" step="any" disabled={ro} value={f.weight} onChange={(e) => setF('weight', e.target.value)} className={fld} aria-label="重量" /></div>
                <div><label className={lbl}>可用重量 (%)</label><input type="number" min="0" step="any" disabled={ro} value={f.yieldRate} onChange={(e) => setF('yieldRate', e.target.value)} className={fld} aria-label="可用重量" /></div>
                <div><label className={lbl}>營業稅 (%)</label><input type="number" min="0" step="any" disabled={ro} value={f.taxRate} onChange={(e) => setF('taxRate', e.target.value)} className={fld} aria-label="營業稅" /></div>
                <div className="col-span-2"><label className={lbl}>可用重量說明</label><AutoText disabled={ro} value={f.yieldNote || ''} onChange={(e) => setF('yieldNote', e.target.value)} maxLength={500} placeholder={ro ? '' : '例如：去骨後剩 85%'} className={`${fld} !h-auto min-h-[52px] leading-relaxed`} aria-label="可用重量說明" /></div>
              </div>
              <div className="mt-5 bg-[#111111] rounded-[20px] p-5">
                <p className="text-[11px] text-neutral-400 font-bold tracking-wide break-words">{unitCost === null ? '請完整輸入售價、重量、可用重量與營業稅。' : `$${num(f.price)} ÷（${num(f.weight)}${f.weightUnit} × ${num(f.yieldRate)}%）× (1 + ${num(f.taxRate)}%)`}</p>
                <div className="flex items-end justify-between gap-3 mt-2">
                  <div><span className="block text-[10px] text-neutral-400 font-bold tracking-widest">食材成本</span><span className="text-3xl font-black text-white">{unitCost === null ? '—' : `$${fmtUC(unitCost)}`}</span><span className="text-xs text-neutral-400 font-bold ml-1">/{f.weightUnit}</span></div>
                  {unitCost !== null && <div className="text-right"><span className="block text-[10px] text-neutral-400 font-bold tracking-widest">此單品 {qty}{f.weightUnit}</span><span className="text-lg font-black text-white">${(unitCost * qty).toFixed(2)}</span></div>}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                {ro ? (
                  <>
                    <button onClick={close} className="px-5 py-2.5 rounded-full bg-[#F5F5F5] hover:bg-neutral-200 text-black font-bold text-sm transition-colors">關閉</button>
                    <button onClick={startEdit} aria-label="編輯食材成本" className="px-5 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white font-bold text-sm flex items-center gap-2 transition-colors"><Pencil size={14} /> 編輯</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setDetailEditing(false); setDetailForm(null); }} className="px-5 py-2.5 rounded-full bg-[#F5F5F5] hover:bg-neutral-200 text-black font-bold text-sm transition-colors">取消編輯</button>
                    <button onClick={save} disabled={unitCost === null} className="px-5 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><Save size={14} /> 儲存變更</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderConfirmDialog = () => {
    if (!confirmDlg) return null;
    const need = confirmDlg.requireText || '';
    const canGo = !need || confirmInput.trim() === need;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={closeConfirm} onKeyDown={(e) => { if (e.key === 'Escape') closeConfirm(); }}>
        <div role="alertdialog" aria-modal="true" className="w-full max-w-sm bg-white rounded-[24px] p-6 border border-[#B4B4BE] shadow-[0_20px_60px_rgba(0,0,0,0.35)]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0"><AlertCircle size={20} /></div>
            <h3 className="text-lg font-black text-black">{confirmDlg.title || '確定要刪除嗎？'}</h3>
          </div>
          <p className="text-sm font-medium text-[#5F5F68] whitespace-pre-line leading-relaxed mb-2">{confirmDlg.message}</p>
          <p className="text-xs font-bold text-red-500 mb-4">此動作無法復原。</p>
          {need && (
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#5F5F68] mb-2">請輸入「{need}」以確認</label>
              <input value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} className="w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold" />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button autoFocus onClick={closeConfirm} className="px-5 py-2.5 rounded-full bg-[#F5F5F5] hover:bg-neutral-200 text-black font-bold text-sm transition-colors">取消</button>
            <button disabled={!canGo} onClick={() => { const fn = confirmDlg.onConfirm; closeConfirm(); if (fn) fn(); }} className="px-5 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed">{confirmDlg.confirmText || '確定刪除'}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderToast = () => {
    if (!notice) return null;
    const ok = notice.type === 'success';
    return (
      <div className={`fixed bottom-28 md:bottom-8 right-4 md:right-8 z-[120] max-w-sm p-4 rounded-2xl flex items-center text-sm font-bold shadow-[0_10px_30px_rgba(0,0,0,0.12)] border ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200'}`}>
        {ok ? <CheckCircle className="w-4 h-4 mr-2 shrink-0" /> : <AlertCircle className="w-4 h-4 mr-2 shrink-0" />}
        <span>{notice.text}</span>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans selection:bg-neutral-200 relative overflow-hidden">
        <style>
          {`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-6px); }
              40%, 80% { transform: translateX(6px); }
            }
            .animate-shake {
              animation: shake 0.4s ease-in-out;
            }
          `}
        </style>
        <div className={`w-full max-w-[320px] flex flex-col items-center z-10 ${isShaking ? 'animate-shake' : ''}`}>
          <div className="w-16 h-16 bg-[#F5F5F5] rounded-[20px] flex items-center justify-center mb-8 border border-neutral-100 shadow-sm">
            <Lock className="w-8 h-8 text-black" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-semibold text-black tracking-wide mb-12">{texts.loginTitle}</h1>
          <div className="w-full">
            <form onSubmit={handleLogin} className="flex flex-col items-center">
              <div className="flex items-center justify-center gap-6 mb-8 relative w-full h-[30px]">
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = pin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ease-out ${
                        isFilled ? 'bg-black scale-125 shadow-[0_4px_10px_rgba(0,0,0,0.15)]' : 'bg-[#E5E5E5]'
                      }`}
                    />
                  );
                })}
                <input
                  type="tel"
                  maxLength="4"
                  value={pin}
                  onChange={(e) => {
                    setError(''); 
                    setPin(e.target.value.replace(/\D/g, ''));
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-none z-10"
                  autoFocus
                />
              </div>
              <div className="h-6 mb-8 flex items-center justify-center w-full">
                {(pin.length < 4 || error) && (
                   <p className="text-[#E04D41] text-xs font-bold tracking-wide">{error || texts.loginErrorNotLongEnough}</p>
                )}
              </div>
              <button
                type="submit" disabled={pin.length !== 4}
                className="w-full bg-black text-white hover:bg-neutral-800 disabled:bg-[#F5F5F5] disabled:text-neutral-400 disabled:cursor-not-allowed font-bold py-4 rounded-[20px] transition-all text-sm tracking-wide shadow-[0_10px_20px_rgba(0,0,0,0.08)] disabled:shadow-none"
              >
                {texts.loginButton}
              </button>
              <button
               type="button"
               onClick={() => setPin('')}
               className="w-full text-center mt-6 text-[#5F5F68] hover:text-black font-bold text-sm tracking-wide transition-colors"
              >
                {texts.loginCancel}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderSettingsTab = () => {
    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabSettings}</h2>
            <p className="text-[#5F5F68] font-medium text-sm mt-2 tracking-wide">設定全域稅率、顯示名稱與各項食材規則。</p>
          </div>
          <button 
            onClick={saveSettings}
            className="w-full sm:w-auto bg-black hover:bg-neutral-800 text-white px-8 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:bg-neutral-200 disabled:text-neutral-400 shadow-[0_10px_20px_rgba(0,0,0,0.08)]"
          >
            <Save size={18} /> 儲存變更
          </button>
        </div>

        <div className="bg-[#DEDEE4] p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
           <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
             <div className="p-2 bg-[#F5F5F5] rounded-full"><Receipt size={20} className="text-black"/></div>
             全域系統設定
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div>
                 <label className="block text-xs font-bold text-[#5F5F68] mb-3 tracking-widest uppercase">系統顯示名稱 (LOGO)</label>
                 <div className="relative">
                   <input 
                     type="text"
                     value={editingGlobalSettings.systemName || ''}
                     onChange={(e) => setEditingGlobalSettings({...editingGlobalSettings, systemName: e.target.value})}
                     className="w-full bg-white border border-[#B4B4BE] rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-black transition-all text-lg"
                     placeholder="例如: FINERP"
                   />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-[#5F5F68] mb-3 tracking-widest uppercase">營業稅率 (%)</label>
                 <div className="relative">
                   <input 
                     type="number" min="0" max="100" step="0.1"
                     value={editingGlobalSettings.taxRate}
                     onChange={(e) => setEditingGlobalSettings({...editingGlobalSettings, taxRate: parseFloat(e.target.value) || 0})}
                     className="w-full bg-white border border-[#B4B4BE] rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-black transition-all text-lg"
                   />
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-[#DEDEE4] p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
           <h3 className="font-black text-lg text-black mb-3 flex items-center gap-3">
             <div className="p-2 bg-[#F5F5F5] rounded-full"><Database size={20} className="text-black"/></div>
             資料備份與還原
           </h3>
           <p className="text-[#5F5F68] font-medium text-sm mb-6 leading-relaxed">所有資料都儲存在這個瀏覽器中。清除瀏覽器資料或更換裝置前，請先匯出備份檔。</p>
           <div className="flex flex-wrap gap-3">
             <button onClick={handleExport} className="flex items-center gap-2 bg-black hover:bg-neutral-800 text-white px-6 py-3 rounded-full font-bold text-sm transition-all"><Download size={16} /> 匯出備份</button>
             <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="flex items-center gap-2 bg-[#F5F5F5] hover:bg-neutral-200 text-black px-6 py-3 rounded-full font-bold text-sm transition-all"><Upload size={16} /> 匯入備份</button>
             <button onClick={handleResetAll} className="flex items-center gap-2 bg-[#F5F5F5] hover:bg-red-50 text-red-500 px-6 py-3 rounded-full font-bold text-sm transition-all"><RotateCcw size={16} /> 清空所有資料</button>
             <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
           </div>
        </div>

        <div className="bg-[#DEDEE4] p-6 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8 flex flex-col gap-5">
           <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[#5F5F68]" />
              </div>
              <input
                type="text" value={settingsSearchQuery} onChange={(e) => setSettingsSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-5 py-4 border-transparent rounded-[24px] bg-[#F5F5F5] text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black transition-all font-medium"
                placeholder="搜尋要設定的項目..."
              />
           </div>
           <div className="flex flex-wrap gap-2">
              {availableCategories.map(cat => (
                 <button
                   key={cat} onClick={() => setSettingsCategoryFilter(cat)}
                   className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${settingsCategoryFilter === cat ? 'bg-black text-white' : 'bg-[#F5F5F5] text-[#5F5F68] hover:bg-neutral-200 hover:text-black'}`}
                 >
                   {cat}
                 </button>
              ))}
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSettingsProducts.map((item, idx) => {
            const rule = editingRules[item.name] || { yieldRate: 100, calculationText: '進貨價 ÷ 100% (無耗損)', recipeUnit: item.unit, recipeConversion: 1 };
            const previewCost = item.rawPrice / (rule.yieldRate / 100);
            const rUnit = rule.recipeUnit || item.unit;
            const rConv = rule.recipeConversion || 1;
            const previewRecipeCost = previewCost / rConv;

            return (
              <div key={idx} className="bg-[#DEDEE4] rounded-[32px] p-8 shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text" value={item.code || ''} placeholder="輸入代號..."
                        onChange={(e) => handleCodeChange(item.name, item.vendor, e.target.value.toUpperCase())}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border outline-none transition-all w-24 text-center ${item.code ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-[#ACACAC] bg-white border-dashed border-neutral-300 focus:border-emerald-500 focus:bg-emerald-50'}`}
                      />
                      <span className="text-[10px] font-bold text-[#5F5F68] uppercase tracking-widest">{item.category}</span>
                    </div>
                    <h3 className="text-2xl font-black text-black leading-tight tracking-tight">{item.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#5F5F68] font-bold tracking-widest uppercase block mb-1">進貨參考價</span>
                    <span className="font-black text-black text-lg">${item.rawPrice} <span className="text-xs text-[#5F5F68] font-medium">/{item.unit}</span></span>
                  </div>
                </div>

                <div className="space-y-5 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-[#5F5F68] mb-3 tracking-widest uppercase">淨肉率 / 良率 (%)</label>
                    <input 
                      type="number" min="1" max="100" value={rule.yieldRate}
                      onChange={(e) => handleRuleChange(item.name, 'yieldRate', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                      className="w-full bg-white border border-[#B4B4BE] rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-black"
                    />
                  </div>
                  
                  {/* 規格轉換區塊 */}
                  <div className="bg-[#F5F5F5] rounded-[24px] p-5">
                    <label className="block text-xs font-bold text-[#5F5F68] mb-4 tracking-widest uppercase">規格轉換（配方用量計算）</label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="bg-white px-4 py-3 rounded-[16px] font-black text-black border border-neutral-200 shrink-0">1 {item.unit}</span>
                      <span className="text-[#5F5F68] font-bold">=</span>
                      <input 
                        type="number" min="0.01" step="0.01" value={rule.recipeConversion || 1}
                        onChange={(e) => handleRuleChange(item.name, 'recipeConversion', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                        className="bg-white border border-neutral-200 rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-black w-24 text-center"
                      />
                      <select
                        value={rule.recipeUnit || item.unit}
                        onChange={(e) => handleRuleChange(item.name, 'recipeUnit', e.target.value)}
                        className="bg-white border border-neutral-200 rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold"
                      >
                        <option value="g">克 (g)</option>
                        <option value="kg">公斤 (kg)</option>
                        <option value="台斤">台斤</option>
                        <option value="斤">斤</option>
                        <option value="個">個</option>
                        <option value="片">片</option>
                        <option value="份">份</option>
                        <option value="包">包</option>
                        <option value="盒">盒</option>
                        <option value="箱">箱</option>
                        <option value="瓶">瓶</option>
                        <option value="ml">毫升 (ml)</option>
                        <option value="L">公升 (L)</option>
                        <option value="件">件</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-[#5F5F68] font-bold mt-3">
                      例如：1箱 = 3000 g，1包 = 600 g，1箱 = 12 個
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5F5F68] mb-3 tracking-widest uppercase">成本算法說明</label>
                    <input 
                      type="text" value={rule.calculationText}
                      onChange={(e) => handleRuleChange(item.name, 'calculationText', e.target.value)}
                      className="w-full bg-white border border-[#B4B4BE] rounded-[20px] px-5 py-4 text-black outline-none focus:ring-2 focus:ring-black font-medium"
                    />
                  </div>
                </div>

                {rConv > 1 && (
                  <div className="mt-6 bg-neutral-50 rounded-[20px] px-5 py-4">
                    <span className="text-[10px] text-[#5F5F68] font-bold tracking-widest uppercase">轉換計算</span>
                    <p className="text-sm font-bold text-black mt-1">
                      ${item.rawPrice}/{item.unit} ÷ {rule.yieldRate}% = ${previewCost.toFixed(2)}/{item.unit} ÷ {rConv}{rUnit} = <span className="text-emerald-600">${previewRecipeCost < 1 ? previewRecipeCost.toFixed(4) : previewRecipeCost.toFixed(2)}/{rUnit}</span>
                    </p>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-[#B4B4BE] flex justify-between items-center">
                  <span className="text-xs font-bold text-[#5F5F68] tracking-widest uppercase flex items-center gap-2">
                    <div className="p-1.5 bg-neutral-100 rounded-full"><Scale size={14} className="text-black"/></div>
                    配方單位成本
                  </span>
                  <span className="font-black text-black text-2xl flex items-center">
                    <DollarSign size={20} className="-mt-0.5 opacity-40" />
                    {previewRecipeCost < 1 ? previewRecipeCost.toFixed(4) : previewRecipeCost.toFixed(2)} 
                    <span className="text-sm opacity-50 font-medium ml-1">/{rUnit}</span>
                  </span>
                </div>
              </div>
            );
          })}
          {filteredSettingsProducts.length === 0 && (
             <div className="col-span-full text-center py-24 text-[#5F5F68] font-medium rounded-[32px] bg-[#F5F5F5]">
                找不到相符的項目。
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderSetMenuTab = () => {
    const fmtMoney = (v) => `$${v.toFixed(2)}`;
    const fmtUnitCost = (v) => (v < 1 ? v.toFixed(4) : v.toFixed(2));
    // 單品資訊：優先取食材成本的最新值；來源被刪除時沿用當初加入時的成本
    const resolveItem = (it) => {
      const calc = costCalcs.find(c => c.id === it.costCalcId);
      const live = calc ? calcCost(calc.price, calc.weight, calc.yieldRate, calc.taxRate) : null;
      return {
        name: calc ? calc.menuName : it.itemName,
        store: calc ? calc.storeName : it.storeName,
        unit: calc ? calc.weightUnit : it.recipeUnit,
        unitCost: live !== null ? live : (it.recipeCost || 0),
        missing: !calc
      };
    };
    const lineCostOf = (it) => resolveItem(it).unitCost * (parseFloat(it.qty) || 0);
    const categoryCostOf = (cat) => (cat.items || []).reduce((sum, it) => sum + lineCostOf(it), 0);

    const updateCategory = (catId, patch) => setCostCategories(prev => prev.map(c => (c.id === catId ? { ...c, ...patch } : c)));

    const handleAddCategory = () => {
      const name = newCategoryName.trim();
      if (!name) { showNotice('error', '請輸入分類名稱。'); return; }
      if (costCategories.some(c => c.name === name)) { showNotice('error', '已有同名分類。'); return; }
      setCostCategories(prev => [...prev, { id: `cc-${newUid()}`, name, items: [] }]);
      setNewCategoryName('');
      setShowNewCategory(false);
      showNotice('success', `已新增分類「${name}」，點擊卡片即可新增單品。`);
    };

    const handleDeleteCategory = (cat) => {
      askConfirm({ title: `刪除分類「${cat.name}」？`, message: `其中 ${(cat.items || []).length} 項單品也會一併刪除。`, onConfirm: () => {
        setCostCategories(prev => prev.filter(c => c.id !== cat.id));
        if (openCategoryId === cat.id) { setOpenCategoryId(null); setAddingItem(null); }
      } });
    };

    // ---------- 分類詳細頁 ----------
    const openCat = costCategories.find(c => c.id === openCategoryId);
    if (openCat) {
      const catOf = (x) => (x && (x.menuCategory || x.category)) || '未分類';
      // 與「每月售價」即時同步：只列出仍有售價紀錄的商品與分類
      const liveMenus = setMenus.filter(m => monthlyPrices.some(r => r.menuId === m.id));
      const addCategories = Array.from(new Set(liveMenus.map(catOf)));
      const addMenus = addingItem && addingItem.category ? liveMenus.filter(m => catOf(m) === addingItem.category) : [];
      const addMenu = addingItem ? setMenus.find(m => m.id === addingItem.menuId) : null;
      // 與該商品對應的食材成本（依每月售價紀錄或名稱＋分類比對），月份新的排前面
      const addCalcs = addMenu ? costCalcs.filter(c => {
        const rec = monthlyPrices.find(r => r.id === c.recordId);
        return rec ? rec.menuId === addMenu.id : (c.menuName === addMenu.name && catOf(c) === catOf(addMenu));
      }).sort((a, b) => b.month.localeCompare(a.month)) : [];
      const calcForAdd = addingItem ? costCalcs.find(c => c.id === addingItem.calcId) : null;
      const addUnitCost = calcForAdd ? calcCost(calcForAdd.price, calcForAdd.weight, calcForAdd.yieldRate, calcForAdd.taxRate) : null;
      const addWeight = addingItem ? parseFloat(addingItem.weight) : NaN;
      const addLineCost = addUnitCost !== null && addWeight > 0 ? addUnitCost * addWeight : null;

      // 同一分類內不可有相同商品（以商品名稱判斷，與成本來源的門店／月份無關）
      // 以「商品」本身（每月售價的商品 ID）判斷重複；不同分類下的同名商品視為不同商品，不會衝突
      const itemMenuId = (it) => { if (it.menuId) return it.menuId; const c = costCalcs.find(x => x.id === it.costCalcId); const rec = c ? monthlyPrices.find(r => r.id === c.recordId) : null; return rec ? rec.menuId : null; };
      const sameProduct = (it) => { const id = itemMenuId(it); if (id) return id === addMenu.id; const c = costCalcs.find(x => x.id === it.costCalcId); return (c ? c.menuName : it.itemName) === addMenu.name && (c ? catOf(c) : '未分類') === catOf(addMenu); };
      const dupItem = addMenu ? openCat.items.find(sameProduct) : null;
      const dupItemMsg = dupItem ? `「${addMenu.name}」已在分類「${openCat.name}」中，不可新增相同的商品。如需調整請直接修改該單品的重量。` : '';

      const handleAddItem = () => {
        if (dupItem) { showNotice('error', dupItemMsg); return; }
        if (!calcForAdd || addLineCost === null) return;
        setCostCategories(prev => prev.map(c => c.id === openCat.id ? { ...c, items: [...c.items, { id: `ci-${newUid()}`, costCalcId: calcForAdd.id, itemName: calcForAdd.menuName, menuId: addMenu ? addMenu.id : '', storeName: calcForAdd.storeName, recipeCost: addUnitCost, recipeUnit: calcForAdd.weightUnit, qty: addWeight, note: (addingItem.note || '').trim() }] } : c));
        setAddingItem(null);
      };
      const handleNote = (itemId, value) => updateCategory(openCat.id, { items: openCat.items.map(i => i.id === itemId ? { ...i, note: value } : i) });
      const handleQty = (itemId, value) => updateCategory(openCat.id, { items: openCat.items.map(i => i.id === itemId ? { ...i, qty: value === '' ? '' : (parseFloat(value) || 0) } : i) });
      const handleRemoveItem = (itemId) => {
      const it = openCat.items.find(i => i.id === itemId);
      askConfirm({ title: `刪除單品「${it ? it.itemName : ''}」？`, message: '會從此分類移除這個單品。', onConfirm: () => updateCategory(openCat.id, { items: openCat.items.filter(i => i.id !== itemId) }) });
    };

      const fieldCls = 'w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all h-[52px]';
      const labelCls = 'block text-xs font-bold text-[#5F5F68] mb-2 tracking-widest uppercase';
      const sortedCalcs = [...costCalcs].sort((a, b) => a.menuName.localeCompare(b.menuName, 'zh-Hant') || b.month.localeCompare(a.month));

      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-24 md:pb-8">
          <button onClick={() => { setOpenCategoryId(null); setAddingItem(null); }} className="flex items-center text-[#5F5F68] hover:text-black font-bold mb-8 transition-all w-fit">
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center mr-3 border border-neutral-100"><ChevronLeft className="w-4 h-4" /></div>
            返回分類列表
          </button>

          <div className="bg-[#DEDEE4] rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <span className="text-[#5F5F68] text-xs font-bold uppercase tracking-widest mb-2 block">分類名稱</span>
              <input
                type="text" value={openCat.name} aria-label="分類名稱"
                onChange={(e) => updateCategory(openCat.id, { name: e.target.value })}
                onBlur={() => { if (!openCat.name.trim()) updateCategory(openCat.id, { name: '未命名分類' }); }}
                className="bg-transparent text-black border-b border-neutral-200 hover:border-neutral-400 focus:border-black px-0 py-2 font-black text-3xl w-full outline-none transition-colors tracking-tight"
                placeholder="輸入分類名稱..."
              />
            </div>
            <div className="bg-black rounded-[24px] px-8 py-5 shrink-0">
              <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">商品成本</span>
              <span className="text-4xl font-black text-white">{fmtMoney(categoryCostOf(openCat))}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-black text-xl tracking-tight">單品 <span className="text-[#5F5F68] text-sm font-bold ml-2">共 {openCat.items.length} 項</span></h3>
            <button onClick={() => setAddingItem(addingItem ? null : { category: '', menuId: '', calcId: '', weight: '' })} className="flex items-center gap-2 bg-black hover:bg-neutral-800 text-white px-5 py-3 rounded-full font-bold text-sm shadow-[0_10px_20px_rgba(0,0,0,0.1)] transition-all whitespace-nowrap">
              <Plus size={14} strokeWidth={3} /> 新增單品
            </button>
          </div>

          {addingItem && (
            <div className="bg-[#DEDEE4] rounded-[24px] p-6 mb-5 border border-[#B4B4BE] shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-black text-lg">新增單品</h4>
                <button onClick={() => setAddingItem(null)} aria-label="關閉" className="w-8 h-8 flex items-center justify-center bg-[#F5F5F5] rounded-full text-black hover:bg-neutral-200 transition-colors"><X size={14} /></button>
              </div>
              {addCategories.length === 0 ? (
                <div className="text-center py-6 bg-[#F5F5F5] rounded-[16px]">
                  <p className="text-red-600 font-bold text-sm mb-3">「{texts.tabMonthlyPrice || '每月售價'}」還沒有任何商品。</p>
                  <button onClick={() => { setAddingItem(null); setCurrentTab('monthlyPrice'); }} className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all">前往「{texts.tabMonthlyPrice || '每月售價'}」登錄</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>1. 分類（來自{texts.tabMonthlyPrice || '每月售價'}）</label>
                      <select value={addingItem.category} onChange={(e) => setAddingItem({ category: e.target.value, menuId: '', calcId: '', weight: '' })} className={fieldCls} aria-label="選擇分類">
                        <option value="" disabled>選擇分類...</option>
                        {addCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>2. 商品（來自{texts.tabMonthlyPrice || '每月售價'}）</label>
                      <select value={addingItem.menuId} disabled={!addingItem.category} onChange={(e) => {
                        const m = setMenus.find(x => x.id === e.target.value);
                        const list = costCalcs.filter(c => { const rec = monthlyPrices.find(r => r.id === c.recordId); return rec ? rec.menuId === m.id : (c.menuName === m.name && catOf(c) === catOf(m)); }).sort((a, b) => b.month.localeCompare(a.month));
                        setAddingItem({ ...addingItem, menuId: e.target.value, calcId: list[0] ? list[0].id : '', weight: '' });
                      }} className={`${fieldCls} disabled:opacity-40 disabled:cursor-not-allowed`} aria-label="選擇商品">
                        <option value="" disabled>選擇商品...</option>
                        {addMenus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    {addMenu && addCalcs.length > 1 && (
                      <div>
                        <label className={labelCls}>成本來源（門店・月份）</label>
                        <select value={addingItem.calcId} onChange={(e) => setAddingItem({ ...addingItem, calcId: e.target.value })} className={fieldCls} aria-label="成本來源">
                          {addCalcs.map(c => {
                            const cc = calcCost(c.price, c.weight, c.yieldRate, c.taxRate);
                            return <option key={c.id} value={c.id}>{c.storeName}・{c.month}{cc === null ? '' : ` $${fmtUnitCost(cc)}/${c.weightUnit}`}</option>;
                          })}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>3. 重量{calcForAdd && <span className="normal-case">（{calcForAdd.weightUnit}）</span>}</label>
                      <input type="number" min="0" step="any" value={addingItem.weight} disabled={!calcForAdd} onChange={(e) => setAddingItem({ ...addingItem, weight: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }} placeholder="例如 100" className={`${fieldCls} disabled:opacity-40 disabled:cursor-not-allowed`} aria-label="重量" />
                    </div>
                    <div>
                      <label className={labelCls}>備註（選填）</label>
                      <div className="relative">
                        <AutoText value={addingItem.note || ''} disabled={!calcForAdd} maxLength={300} onChange={(e) => setAddingItem({ ...addingItem, note: e.target.value })} placeholder="例如：去蒂頭、切丁" className={`${fieldCls} !h-auto min-h-[52px] leading-relaxed pr-12 disabled:opacity-40 disabled:cursor-not-allowed`} aria-label="備註" />
                        {addingItem.note && <button onClick={() => setAddingItem({ ...addingItem, note: '' })} aria-label="清除備註" title="清除備註" className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={16} /></button>}
                      </div>
                    </div>
                  </div>
                  {dupItem && (
                    <div role="alert" className="mt-4 flex items-start gap-2 bg-red-50 border border-red-300 text-red-600 rounded-[16px] px-4 py-3 text-sm font-bold">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{dupItemMsg}</span>
                    </div>
                  )}
                  {addMenu && addCalcs.length === 0 && (
                    <div className="mt-4 bg-white border border-[#B4B4BE] rounded-[16px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-sm font-bold text-red-600">「{addMenu.name}」還沒有在「{texts.tabIngredients}」試算成本，請先試算後再加入。</p>
                      <button onClick={() => { setAddingItem(null); setCurrentTab('ingredients'); }} className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shrink-0">前往「{texts.tabIngredients}」</button>
                    </div>
                  )}
                  <div className="mt-4 bg-[#111111] rounded-[16px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">計算式　單品 × 重量</span>
                      <p className={`text-sm font-bold break-words ${addLineCost === null ? 'text-red-400' : 'text-neutral-300'}`}>{addLineCost === null ? '請選擇分類、商品並輸入重量。' : `$${fmtUnitCost(addUnitCost)}/${calcForAdd.weightUnit} × ${addWeight}${calcForAdd.weightUnit}`}</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">商品成本</span>
                      <span className="text-2xl font-black text-white">{addLineCost === null ? '—' : fmtMoney(addLineCost)}</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <button onClick={() => setAddingItem(null)} className="bg-[#F5F5F5] hover:bg-neutral-200 text-black px-6 py-2.5 rounded-full font-bold text-sm transition-all">取消</button>
                    <button onClick={handleAddItem} disabled={addLineCost === null || !!dupItem} className="bg-black hover:bg-neutral-800 disabled:bg-[#F5F5F5] disabled:text-neutral-400 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all">加入</button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            {openCat.items.map(it => {
              const info = resolveItem(it);
              const line = info.unitCost * (parseFloat(it.qty) || 0);
              return (
                <div key={it.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-[16px] gap-4 shadow-[0_6px_18px_rgba(0,0,0,0.14)] border border-[#B4B4BE] hover:border-[#71717A] transition-colors">
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0"><Tag size={14} className="text-black" /></div>
                    <div className="min-w-0 flex-1 text-left">
                      <h4 className="mb-1.5"><button onClick={() => { setDetailItemId(it.id); setDetailEditing(false); }} title="點擊查看／編輯食材成本" aria-label={`查看 ${info.name} 的食材成本`} className="block max-w-full font-black text-black text-xl leading-none truncate text-left underline decoration-dotted decoration-neutral-400 underline-offset-4 hover:decoration-black hover:decoration-solid transition-all">{info.name}</button></h4>
                      <p className="text-[10px] text-[#5F5F68] font-bold tracking-wide">{info.store} • ${fmtUnitCost(info.unitCost)}/{info.unit}{info.missing ? '（來源已刪除，沿用原成本）' : ''}</p>
                      <div className="relative mt-2 w-full max-w-md">
                        <AutoText value={it.note || ''} onChange={(e) => handleNote(it.id, e.target.value)} maxLength={300} placeholder="備註…" aria-label={`${info.name} 備註`} className="w-full bg-[#F5F5F5] border border-transparent focus:bg-white focus:border-[#B4B4BE] rounded-[18px] pl-4 pr-10 py-2 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-black placeholder:text-neutral-400 leading-relaxed" />
                        {it.note && <button onClick={() => askConfirm({ title: '刪除這則備註？', message: `「${info.name}」的備註：\n${it.note.length > 60 ? it.note.slice(0, 60) + '…' : it.note}`, confirmText: '刪除備註', onConfirm: () => handleNote(it.id, '') })} aria-label={`刪除 ${info.name} 的備註`} title="刪除備註" className="absolute right-1.5 top-1.5 w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={14} /></button>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                    <div className="flex items-center bg-[#F5F5F5] rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-black">
                      <input type="number" min="0" step="any" value={it.qty} onChange={(e) => handleQty(it.id, e.target.value)} onBlur={() => { if (it.qty === '') handleQty(it.id, '0'); }} aria-label={`${info.name} 重量`} className="w-20 px-3 py-2.5 text-center font-black text-black bg-transparent outline-none text-sm" />
                      <span className="text-[#5F5F68] font-bold text-xs pr-4">{info.unit}</span>
                    </div>
                    <div className="min-w-[96px] text-right">
                      <span className="block text-[10px] text-[#5F5F68] font-bold tracking-widest">商品成本</span>
                      <span className="font-black text-black text-lg">{fmtMoney(line)}</span>
                    </div>
                    <button onClick={() => handleRemoveItem(it.id)} title="刪除單品" className="text-neutral-400 hover:text-red-500 transition-colors p-2"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
            {openCat.items.length === 0 && !addingItem && (
              <div className="text-center py-12 border border-dashed border-neutral-300 rounded-[20px] text-[#5F5F68] font-bold text-sm">此分類尚無單品，請點「新增單品」</div>
            )}
          </div>
        </div>
      );
    }

    // ---------- 分類卡片列表 ----------
    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabSetMenus}</h2>
            <p className="text-[#5F5F68] font-medium text-sm mt-2 tracking-wide">建立分類卡片，點入後新增單品並計算商品成本。</p>
          </div>
          <button onClick={() => setShowNewCategory(!showNewCategory)} className="bg-black hover:bg-neutral-800 text-white px-6 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-[0_10px_20px_rgba(0,0,0,0.1)] transition-all shrink-0">
            <FolderPlus size={16} /> 新增分類
          </button>
        </div>

        {showNewCategory && (
          <div className="bg-[#DEDEE4] p-6 rounded-[24px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
            <label className="block text-xs font-bold text-[#5F5F68] mb-3 tracking-widest uppercase">分類名稱</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                placeholder="輸入分類名稱，例如：肉類" aria-label="新分類名稱"
                className="flex-1 min-w-0 bg-white border border-[#B4B4BE] rounded-full px-5 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all"
              />
              <div className="flex gap-3">
                <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="bg-[#F5F5F5] hover:bg-neutral-200 text-black px-6 py-3 rounded-full font-bold text-sm transition-all">取消</button>
                <button onClick={handleAddCategory} className="bg-black hover:bg-neutral-800 text-white px-6 py-3 rounded-full font-bold text-sm transition-all">建立</button>
              </div>
            </div>
          </div>
        )}

        {costCategories.length === 0 ? (
          <div className="text-center py-24 bg-[#F5F5F5] rounded-[32px]">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><Layers size={24} className="text-black" /></div>
            <p className="text-black font-black text-xl mb-2 tracking-tight">尚未建立任何分類</p>
            <p className="text-red-600 font-bold text-sm">點擊右上角「新增分類」開始建立。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {costCategories.map(cat => (
              <div key={cat.id} className="relative group">
                <button onClick={() => { setOpenCategoryId(cat.id); setAddingItem(null); }} aria-label={`開啟分類 ${cat.name}`} className="w-full text-left bg-[#DEDEE4] rounded-3xl p-6 shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] hover:shadow-[0_18px_44px_rgba(0,0,0,0.32)] hover:-translate-y-0.5 hover:border-[#71717A] transition-all flex flex-col">
                  <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center mb-4"><Utensils size={18} className="text-black" strokeWidth={1.5} /></div>
                  <h3 className="text-lg font-black text-black mb-1 tracking-tight truncate pr-10">{cat.name}</h3>
                  <p className="text-xs font-bold text-[#52525B] mb-5">{(cat.items || []).length} 項單品</p>
                  <div className="pt-4 border-t border-[#B4B4BE] flex items-center justify-between">
                    <span className="text-xs font-bold text-red-600">點擊查看商品成本</span>
                    <ChevronRight size={18} className="text-neutral-400 group-hover:text-black transition-colors" />
                  </div>
                </button>
                <button onClick={() => handleDeleteCategory(cat)} title="刪除分類" className="absolute top-4 right-4 p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMonthlyPriceTab = () => {
    const [yy, mm] = selectedMonth.split('-');
    const shiftMonth = (delta) => {
      const d = new Date(parseInt(yy, 10), parseInt(mm, 10) - 1 + delta, 1);
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const categoryOf = (m) => m.menuCategory || '未分類';
    const liveMenus = setMenus.filter(m => monthlyPrices.some(r => r.menuId === m.id)); // 已沒有任何售價紀錄的商品不顯示
    const categoryOptions = Array.from(new Set(liveMenus.map(categoryOf)));
    const menuOptions = liveMenus.filter(m => categoryOf(m) === mpForm.category);
    const monthRecords = monthlyPrices.filter(r => r.month === selectedMonth);
    const recName = (r) => { const live = setMenus.find(m => m.id === r.menuId); return live ? live.name : r.menuName; };
    const recCategory = (r) => { const live = setMenus.find(m => m.id === r.menuId); return live ? categoryOf(live) : (r.category || '未分類'); };
    const recQuery = recSearch.trim().toLowerCase();
    const recCatList = Array.from(new Set(monthRecords.map(recCategory))).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const filteredRecords = monthRecords.filter(r => (!recCat || recCategory(r) === recCat) && (!recQuery || recName(r).toLowerCase().includes(recQuery) || recCategory(r).toLowerCase().includes(recQuery)));
    const toggleCollapse = (key) => setCollapsedCats(prev => ({ ...prev, [key]: !prev[key] }));

    const handleAddStore = () => {
      const name = newStoreName.trim();
      if (!name) { showNotice('error', '請輸入門店名稱。'); return; }
      if (stores.some(st => st.name === name)) { showNotice('error', '已有同名門店。'); return; }
      const store = { id: newUid(), name };
      setStores(prev => [...prev, store]);
      setMpForm({ storeId: store.id, category: '', menuId: '', price: '' });
      setNewStoreName('');
      showNotice('success', `已新增門店「${name}」。`);
    };

    const catCount = (name) => liveMenus.filter(m => categoryOf(m) === name).length;
    const handleRenameCategory = () => {
      if (!editingCat) return;
      const oldName = editingCat.name; const newName = editingCat.value.trim();
      if (!newName) { showNotice('error', '請輸入分類名稱。'); return; }
      if (newName === oldName) { setEditingCat(null); return; }
      if (categoryOptions.includes(newName)) { showNotice('error', '已有同名分類。'); return; }
      setSetMenus(prev => prev.map(m => categoryOf(m) === oldName ? { ...m, menuCategory: newName } : m));
      setMonthlyPrices(prev => prev.map(r => (r.category || '未分類') === oldName ? { ...r, category: newName } : r));
      setCostCalcs(prev => prev.map(c => (c.category || '未分類') === oldName ? { ...c, category: newName } : c));
      if (mpForm.category === oldName) setMpForm({ ...mpForm, category: newName });
      if (quickCat === oldName) setQuickCat(newName);
      setEditingCat(null);
      showNotice('success', `已將分類「${oldName}」改名為「${newName}」。`);
    };
    const handleDeleteCategory2 = (name) => {
      const menuIds = setMenus.filter(m => categoryOf(m) === name).map(m => m.id);
      const recCount = monthlyPrices.filter(r => menuIds.includes(r.menuId)).length;
      askConfirm({ title: `刪除分類「${name}」？`, message: `該分類下 ${menuIds.length} 個商品與 ${recCount} 筆每月售價紀錄也會一併刪除。\n已儲存的食材成本與商品計算不受影響。`, onConfirm: () => {
        setSetMenus(prev => prev.filter(m => categoryOf(m) !== name));
        setMonthlyPrices(prev => prev.filter(r => !menuIds.includes(r.menuId)));
        if (mpForm.category === name) setMpForm({ ...mpForm, category: '', menuId: '', price: '' });
        if (quickCat === name) setQuickCat(null);
        setEditingCat(null);
      } });
    };

    // 從分類卡片快速選取商品：帶入下方登錄表單，只剩輸入售價
    const handleQuickPick = (menu) => {
      const storeId = mpForm.storeId || (stores.length === 1 ? stores[0].id : '');
      if (!storeId) { showNotice('error', '請先在下方「登錄售價」選擇門店。'); return; }
      setMpForm({ storeId, category: categoryOf(menu), newCategory: '', menuId: menu.id, newMenuName: '', price: '' });
      setTimeout(() => { const el = document.getElementById('mp-price'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }, 60);
    };

    const handleDeleteStore = (store) => {
      const count = monthlyPrices.filter(r => r.storeId === store.id).length;
      askConfirm({ title: `刪除門店「${store.name}」？`, message: count > 0 ? `該門店共 ${count} 筆每月售價紀錄也會一併刪除。` : '此門店沒有售價紀錄。', onConfirm: () => {
        setStores(prev => prev.filter(st => st.id !== store.id));
        setMonthlyPrices(prev => prev.filter(r => r.storeId !== store.id));
        if (mpForm.storeId === store.id) setMpForm({ storeId: '', category: '', menuId: '', price: '' });
      } });
    };

    const isNewCategory = mpForm.category === '__new__';
    const isNewMenu = isNewCategory || mpForm.menuId === '__new__';
    const resolvedCategory = isNewCategory ? (mpForm.newCategory || '').trim() : mpForm.category;
    const resolvedMenuName = isNewMenu ? (mpForm.newMenuName || '').trim() : '';
    const dupMenu = isNewMenu ? setMenus.find(m => categoryOf(m) === resolvedCategory && m.name === resolvedMenuName) : setMenus.find(m => m.id === mpForm.menuId);
    const dupRecord = dupMenu && mpForm.storeId ? monthlyPrices.find(r => r.month === selectedMonth && r.storeId === mpForm.storeId && r.menuId === dupMenu.id) : null;
    const dupMsg = dupRecord ? `「${dupMenu.name}」在 ${yy} 年 ${parseInt(mm, 10)} 月已登錄過，不可輸入相同的商品。如需修改請直接在下方紀錄調整售價。` : '';
    const canSave = !!mpForm.storeId && !!resolvedCategory && (isNewMenu ? !!resolvedMenuName : !!mpForm.menuId) && mpForm.price !== '' && !dupRecord;

    const handleSavePrice = () => {
      const price = parseFloat(mpForm.price);
      if (!mpForm.storeId) { showNotice('error', '請先選擇門店。'); return; }
      if (!resolvedCategory) { showNotice('error', '請選擇或輸入分類。'); return; }
      if (isNewMenu && !resolvedMenuName) { showNotice('error', '請輸入商品名稱。'); return; }
      if (!isNewMenu && !mpForm.menuId) { showNotice('error', '請選擇商品。'); return; }
      if (mpForm.price === '' || isNaN(price) || price < 0) { showNotice('error', '請輸入正確的售價。'); return; }
      if (dupRecord) { showNotice('error', dupMsg); return; }

      // 取得商品；若是新商品就在這裡直接建立（同分類下同名則沿用既有商品，避免重複）
      let menu = isNewMenu ? setMenus.find(m => categoryOf(m) === resolvedCategory && m.name === resolvedMenuName) : setMenus.find(m => m.id === mpForm.menuId);
      if (!menu) {
        menu = { id: `sm-${newUid()}`, name: resolvedMenuName, menuCategory: resolvedCategory === '未分類' ? '' : resolvedCategory, sellingPrice: 0, categories: [] };
        setSetMenus(prev => [...prev, menu]);
      }
      if (!menu) return;

      const existing = monthlyPrices.find(r => r.month === selectedMonth && r.storeId === mpForm.storeId && r.menuId === menu.id);
      if (existing) {
        setMonthlyPrices(prev => prev.map(r => r.id === existing.id ? { ...r, price, menuName: menu.name, category: categoryOf(menu) } : r));
        showNotice('success', `已更新「${menu.name}」${yy} 年 ${parseInt(mm, 10)} 月的售價。`);
      } else {
        setMonthlyPrices(prev => [...prev, { id: newUid(), month: selectedMonth, storeId: mpForm.storeId, menuId: menu.id, menuName: menu.name, category: categoryOf(menu), price }]);
        showNotice('success', `已登錄「${menu.name}」$${price}。`);
      }
      // 保留門店與分類，方便連續輸入同分類的下一個商品
      setMpForm({ storeId: mpForm.storeId, category: resolvedCategory, newCategory: '', menuId: '', newMenuName: '', price: '' });
    };

    const handleChangeRecordPrice = (id, value) => {
      setMonthlyPrices(prev => prev.map(r => r.id === id ? { ...r, price: value === '' ? '' : (parseFloat(value) || 0) } : r));
    };
    const handleBlurRecordPrice = (id) => {
      setMonthlyPrices(prev => prev.map(r => r.id === id && r.price === '' ? { ...r, price: 0 } : r));
    };
    const handleDeleteRecord = (rec, productName) => {
      const lastOne = !monthlyPrices.some(r => r.menuId === rec.menuId && r.id !== rec.id);
      askConfirm({ title: `刪除「${productName}」售價紀錄？`, message: lastOne ? '這是此商品唯一的售價紀錄，刪除後商品也會從「商品計算」的選單中移除。' : '只會刪除這個月份的這筆售價。', onConfirm: () => {
        setMonthlyPrices(prev => prev.filter(r => r.id !== rec.id));
        if (lastOne) setSetMenus(prev => prev.filter(m => m.id !== rec.menuId));
      } });
    };

    const selectCls = 'w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed';
    const labelCls = 'block text-xs font-bold text-[#5F5F68] mb-2 tracking-widest uppercase';

    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabMonthlyPrice || '每月售價'}</h2>
            <p className="text-[#5F5F68] font-medium text-sm mt-2 tracking-wide">依門店登錄每個月的商品售價金額。</p>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-full border border-[#B4B4BE] shadow-[0_8px_24px_rgba(0,0,0,0.16)] p-1.5 self-start sm:self-auto">
            <button onClick={() => shiftMonth(-1)} aria-label="上個月" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F5F5] hover:bg-neutral-200 text-black transition-colors"><ChevronLeft size={16} /></button>
            <input
              type="month" value={selectedMonth} aria-label="選擇月份"
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="bg-transparent font-black text-black text-sm outline-none px-2 text-center"
            />
            <button onClick={() => shiftMonth(1)} aria-label="下個月" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F5F5] hover:bg-neutral-200 text-black transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* 門店管理 */}
        <div className="bg-[#DEDEE4] p-6 md:p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
          <h3 className="font-black text-lg text-black mb-5 flex items-center gap-3">
            <div className="p-2 bg-white rounded-full"><Store size={20} className="text-black" /></div>
            門店
          </h3>
          <div className="flex flex-wrap gap-2 mb-5">
            {stores.map(st => (
              <span key={st.id} className="inline-flex items-center gap-1 bg-white border border-[#B4B4BE] text-black font-bold text-sm pl-4 pr-1.5 py-1.5 rounded-full">
                {st.name}
                <button onClick={() => handleDeleteStore(st)} aria-label={`刪除門店 ${st.name}`} className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={14} /></button>
              </span>
            ))}
            {stores.length === 0 && <span className="text-red-600 font-bold text-sm py-2">尚未建立門店，請先新增第一間門店。</span>}
          </div>
          <div className="flex gap-3 max-w-md">
            <input
              type="text" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStore(); }}
              placeholder="輸入門店名稱..."
              className="flex-1 min-w-0 bg-white border border-[#B4B4BE] rounded-full px-5 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all text-sm"
            />
            <button onClick={handleAddStore} className="bg-black hover:bg-neutral-800 text-white px-5 py-3 rounded-full font-bold text-sm flex items-center gap-2 transition-all shrink-0"><Plus size={16} strokeWidth={3} /> 新增門店</button>
          </div>
        </div>

        {/* 商品分類：可改名、刪除 */}
        <div className="bg-[#DEDEE4] p-6 md:p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
          <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
            <div className="p-2 bg-white rounded-full"><Tag size={20} className="text-black" /></div>
            商品分類
          </h3>
          <div className="flex flex-wrap gap-3">
            {categoryOptions.map(name => (
              editingCat && editingCat.name === name ? (
                <span key={name} className="inline-flex items-center gap-1 bg-white border-2 border-black pl-3 pr-1.5 py-1 rounded-full">
                  <input autoFocus value={editingCat.value} onChange={(e) => setEditingCat({ ...editingCat, value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(); if (e.key === 'Escape') setEditingCat(null); }} aria-label="分類名稱" className="w-32 bg-transparent outline-none font-bold text-sm text-black" />
                  <button onClick={handleRenameCategory} aria-label="儲存分類名稱" className="w-7 h-7 flex items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditingCat(null)} aria-label="取消編輯" className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 transition-colors"><X size={14} /></button>
                </span>
              ) : (
                <span key={name} className="inline-flex items-center gap-1 bg-white border border-[#B4B4BE] text-black font-bold text-sm pl-4 pr-1.5 py-1.5 rounded-full">
                  <button onClick={() => setQuickCat(quickCat === name ? null : name)} aria-pressed={quickCat === name} aria-label={`查看分類 ${name} 的商品`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 -ml-2 transition-colors ${quickCat === name ? 'bg-black text-white' : 'hover:bg-neutral-100'}`}>
                    {name}<span className={`text-[11px] font-bold ml-1 ${quickCat === name ? 'text-neutral-300' : 'text-[#5F5F68]'}`}>{catCount(name)}</span>
                  </button>
                  <button onClick={() => setEditingCat({ name, value: name })} aria-label={`編輯分類 ${name}`} className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => handleDeleteCategory2(name)} aria-label={`刪除分類 ${name}`} className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={14} /></button>
                </span>
              )
            ))}
            {categoryOptions.length === 0 && <span className="text-red-600 font-bold text-sm py-2">尚未建立分類，請在下方登錄售價時選擇「+ 新增分類...」。</span>}
          </div>
          {quickCat && categoryOptions.includes(quickCat) && (
            <div className="mt-5 bg-white border border-[#B4B4BE] rounded-[20px] p-4">
              <p className="text-xs font-bold text-[#5F5F68] mb-3 tracking-widest">「{quickCat}」的商品・點選即可帶入下方登錄售價</p>
              <div className="flex flex-wrap gap-2">
                {liveMenus.filter(m => categoryOf(m) === quickCat).map(m => {
                  const rec = mpForm.storeId ? monthlyPrices.find(r => r.month === selectedMonth && r.storeId === mpForm.storeId && r.menuId === m.id) : null;
                  const picked = mpForm.menuId === m.id;
                  return (
                    <button key={m.id} onClick={() => handleQuickPick(m)} disabled={!!rec} aria-label={`選取商品 ${m.name}`}
                      className={`px-4 py-2 rounded-full font-bold text-sm border transition-all ${rec ? 'bg-[#F5F5F5] text-neutral-400 border-neutral-200 cursor-not-allowed' : picked ? 'bg-black text-white border-black' : 'bg-white text-black border-[#B4B4BE] hover:border-black hover:-translate-y-0.5'}`}>
                      {m.name}{rec && <span className="ml-2 text-[11px] text-emerald-600">已登錄 ${rec.price}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 登錄售價：門店 → 分類 → 商品 → 售價 */}
        <div className="bg-[#DEDEE4] p-6 md:p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
          <h3 className="font-black text-lg text-black mb-6 flex items-center gap-3">
            <div className="p-2 bg-white rounded-full"><CalendarDays size={20} className="text-black" /></div>
            登錄 {yy} 年 {parseInt(mm, 10)} 月售價
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-5 items-start">
            <div>
              <label className={labelCls}>1. 門店</label>
              <select value={mpForm.storeId} onChange={(e) => setMpForm({ storeId: e.target.value, category: '', newCategory: '', menuId: '', newMenuName: '', price: '' })} className={selectCls}>
                <option value="" disabled>選擇門店...</option>
                {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
              {stores.length === 0 && <p className="text-[11px] text-red-600 font-bold mt-2">請先在上方新增門店</p>}
            </div>
            <div>
              <label className={labelCls}>2. 分類</label>
              <select
                value={mpForm.category} disabled={!mpForm.storeId}
                onChange={(e) => setMpForm({ ...mpForm, category: e.target.value, newCategory: '', menuId: e.target.value === '__new__' ? '__new__' : '', newMenuName: '', price: '' })}
                className={selectCls}
              >
                <option value="" disabled>選擇分類...</option>
                <option value="__new__">+ 新增分類...</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {isNewCategory && (
                <input type="text" value={mpForm.newCategory || ''} onChange={(e) => setMpForm({ ...mpForm, newCategory: e.target.value })} placeholder="輸入新分類名稱" autoFocus className={`${selectCls} mt-2`} />
              )}
            </div>
            <div>
              <label className={labelCls}>3. 商品</label>
              <select
                value={isNewCategory ? '__new__' : mpForm.menuId} disabled={!mpForm.category || isNewCategory}
                onChange={(e) => setMpForm({ ...mpForm, menuId: e.target.value, newMenuName: '', price: '' })}
                className={selectCls}
              >
                <option value="" disabled>選擇商品...</option>
                <option value="__new__">+ 新增商品...</option>
                {menuOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {isNewMenu && (
                <input type="text" value={mpForm.newMenuName || ''} onChange={(e) => setMpForm({ ...mpForm, newMenuName: e.target.value })} placeholder="輸入新商品名稱" className={`${selectCls} mt-2`} />
              )}
            </div>
            <div>
              <label className={labelCls}>4. 售價 ($)</label>
              <input
                id="mp-price" type="number" min="0" step="1" value={mpForm.price} disabled={isNewMenu ? !resolvedMenuName : !mpForm.menuId}
                onChange={(e) => setMpForm({ ...mpForm, price: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(); }}
                placeholder="0" className={selectCls}
              />
            </div>
            <div className="2xl:pt-[26px]">
              <button onClick={handleSavePrice} disabled={!canSave} className="w-full bg-black hover:bg-neutral-800 disabled:bg-[#F5F5F5] disabled:text-neutral-400 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all">
                <Save size={16} /> 登錄售價
              </button>
            </div>
          </div>
          {dupRecord && (
            <div role="alert" className="mt-5 flex items-start gap-2 bg-red-50 border border-red-300 text-red-600 rounded-[16px] px-4 py-3 text-sm font-bold">
              <AlertCircle size={18} className="shrink-0 mt-0.5" /><span>{dupMsg}</span>
            </div>
          )}
        </div>

        {/* 當月紀錄 */}
        <h3 className="text-xl font-black text-black tracking-tight mb-5">{yy} 年 {parseInt(mm, 10)} 月售價紀錄 <span className="text-[#5F5F68] text-sm font-bold ml-2">共 {monthRecords.length} 筆</span></h3>
        {monthRecords.length === 0 ? (
          <div className="text-center py-20 text-red-600 font-bold rounded-[32px] bg-[#F5F5F5]">這個月還沒有登錄任何售價。</div>
        ) : (
          <>
          <div className="bg-[#DEDEE4] p-5 rounded-[24px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-6">
            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" value={recSearch} onChange={(e) => setRecSearch(e.target.value)} placeholder="搜尋商品或分類…" aria-label="搜尋售價紀錄" className="w-full bg-white border border-[#B4B4BE] rounded-full pl-11 pr-10 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold" />
              {recSearch && <button onClick={() => setRecSearch('')} aria-label="清除搜尋" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100"><X size={14} /></button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setRecCat('')} aria-pressed={!recCat} className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${!recCat ? 'bg-black text-white border-black' : 'bg-white text-black border-[#B4B4BE] hover:border-black'}`}>全部 {monthRecords.length}</button>
              {recCatList.map(c => (
                <button key={c} onClick={() => setRecCat(recCat === c ? '' : c)} aria-pressed={recCat === c} className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${recCat === c ? 'bg-black text-white border-black' : 'bg-white text-black border-[#B4B4BE] hover:border-black'}`}>{c} {monthRecords.filter(r => recCategory(r) === c).length}</button>
              ))}
              <span className="flex-1" />
              <button onClick={() => { const keys = {}; stores.forEach(st => recCatList.forEach(c => { keys[st.id + '|' + c] = true; })); setCollapsedCats(Object.keys(collapsedCats).some(k => collapsedCats[k]) ? {} : keys); }} className="text-xs font-bold text-[#5F5F68] hover:text-black underline underline-offset-4">{Object.keys(collapsedCats).some(k => collapsedCats[k]) ? '全部展開' : '全部收合'}</button>
            </div>
          </div>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-16 text-red-600 font-bold rounded-[32px] bg-[#F5F5F5]">找不到符合的商品。</div>
          ) : (
          <div className="space-y-6">
            {stores.map(st => {
              const rows = filteredRecords.filter(r => r.storeId === st.id).sort((a, b) => recCategory(a).localeCompare(recCategory(b), 'zh-Hant') || recName(a).localeCompare(recName(b), 'zh-Hant'));
              if (rows.length === 0) return null;
              const groups = []; rows.forEach(r => { const c = recCategory(r); const g = groups.find(x => x[0] === c); if (g) g[1].push(r); else groups.push([c, [r]]); });
              return (
                <div key={st.id} className="bg-white rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] overflow-hidden">
                  <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <span className="flex items-center gap-3 font-black text-black"><Store size={16} /> {st.name}</span>
                    <span className="text-xs font-bold text-[#5F5F68]">{rows.length} 項商品</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="px-6 py-3 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest">分類</th>
                          <th className="px-6 py-3 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest">商品</th>
                          <th className="px-6 py-3 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">售價</th>
                          <th className="px-3 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map(([cat, list]) => {
                          const key = st.id + '|' + cat;
                          const open = recQuery ? true : !collapsedCats[key];
                          return (
                            <React.Fragment key={key}>
                              <tr onClick={() => toggleCollapse(key)} className="bg-[#EFEFF3] cursor-pointer hover:bg-[#E6E6EC] border-b border-[#D4D4DC] select-none">
                                <td colSpan={4} className="px-6 py-3">
                                  <span className="flex items-center gap-2 font-black text-black text-sm">
                                    <ChevronDown size={16} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
                                    {cat}
                                    <span className="text-xs font-bold text-[#5F5F68]">{list.length} 項</span>
                                  </span>
                                </td>
                              </tr>
                              {open && (
                                <>
                                {list.map(r => {
                                  const live = setMenus.find(m => m.id === r.menuId);
                                  const productName = live ? live.name : r.menuName;
                                  return (
                                    <tr key={r.id} className="border-b border-neutral-50 hover:bg-[#F9F9F9] transition-colors">
                                      <td className="px-6 py-3"><span className="text-xs font-bold text-[#5F5F68] bg-[#F5F5F5] px-3 py-1 rounded-full">{live ? categoryOf(live) : r.category}</span></td>
                                      <td className="px-6 py-3 font-black text-black text-base tracking-tight">{productName}</td>
                                      <td className="px-6 py-3 text-right">
                                        <span className="text-[#6B6B76] text-sm mr-0.5">$</span>
                                        <input
                                          type="number" min="0" value={r.price} aria-label={`${productName} 售價`}
                                          onChange={(e) => handleChangeRecordPrice(r.id, e.target.value)}
                                          onBlur={() => handleBlurRecordPrice(r.id)}
                                          className="font-black text-black text-base bg-transparent outline-none w-20 text-right focus:bg-[#F5F5F5] rounded-lg px-1 py-0.5 transition-colors"
                                        />
                                      </td>
                                      <td className="px-3 py-3 text-right">
                                        <button onClick={() => handleDeleteRecord(r, productName)} title="刪除" className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={15} /></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                                </>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
          )}
          </>
        )}
      </div>
    );
  };

  const renderSellingPriceTab = () => {
    const multiplier = foodCostPercent > 0 ? (100 / foodCostPercent) : 0;

    // 計算每個商品的食材成本與建議售價
    const menuPricingData = setMenus.map(menu => {
      let totalIngredientsCost = 0;
      (menu.categories || []).forEach(cat => {
        (cat.items || []).forEach(ig => {
          const latestInfo = findIngredient(ig);
          totalIngredientsCost += (latestInfo.recipeCost || latestInfo.finalCost || 0) * ig.qty;
        });
      });
      const suggestedPrice = foodCostPercent > 0 ? totalIngredientsCost / (foodCostPercent / 100) : 0;
      const roundedPrice = Math.ceil(suggestedPrice / 5) * 5; // 無條件進位到 5 的倍數
      return { ...menu, totalIngredientsCost, suggestedPrice, roundedPrice };
    });

    // 計算每項食材的單位售價
    const ingredientPricingData = allAvailableIngredients.map(item => {
      const suggestedPrice = foodCostPercent > 0 ? item.finalCost / (foodCostPercent / 100) : 0;
      return { ...item, suggestedPrice };
    });

    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabSellingPrice || '售價金額'}</h2>
            <p className="text-[#5F5F68] font-medium text-sm mt-2 tracking-wide">依食材成本百分比，自動推算建議售價。</p>
          </div>
        </div>

        {/* 公式與參數設定卡片 */}
        <div className="bg-[#DEDEE4] rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] p-6 md:p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            <div className="flex-1">
              <span className="block text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest mb-3">售價公式</span>
              <div className="bg-[#F5F5F5] rounded-[20px] p-4 sm:p-5 flex flex-wrap items-center gap-2 sm:gap-3 text-base sm:text-lg font-black text-black tracking-tight">
                <span>售價</span>
                <span className="text-[#5F5F68] font-medium">=</span>
                <span className="text-sm sm:text-lg">食材成本</span>
                <span className="text-[#5F5F68] font-medium">÷</span>
                <div className="inline-flex items-center bg-white rounded-xl border border-neutral-200 shadow-sm px-2 sm:px-3 py-1.5">
                  <input
                    type="number" value={foodCostPercent}
                    onChange={e => setFoodCostPercent(parseFloat(e.target.value) || 0)}
                    className="bg-transparent outline-none font-black text-black w-14 sm:w-16 text-center text-base sm:text-lg"
                    step="0.01" min="0" max="100"
                  />
                  <span className="text-[#5F5F68] font-bold text-sm sm:text-base">%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center bg-[#F5F5F5] rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 lg:px-8 shrink-0">
              <span className="text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest mb-1">成本佔比</span>
              <span className="text-3xl sm:text-4xl font-black text-black">{foodCostPercent}%</span>
              <span className="text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest mt-1">倍率 ×{multiplier.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            {[{label: '高利潤 (25%)', val: 25}, {label: '標準 (33.33%)', val: 33.33}, {label: '薄利 (40%)', val: 40}, {label: '極薄利 (50%)', val: 50}].map(preset => (
              <button key={preset.val} onClick={() => setFoodCostPercent(preset.val)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${foodCostPercent === preset.val ? 'bg-black text-white shadow-[0_10px_20px_rgba(0,0,0,0.1)]' : 'bg-[#F5F5F5] text-[#5F5F68] hover:bg-neutral-200 hover:text-black'}`}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 商品建議售價區塊 */}
        {menuPricingData.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-black text-black tracking-tight mb-5 flex items-center gap-3">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center"><Utensils size={14} className="text-white" /></div>
              商品建議售價
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {menuPricingData.map(menu => {
                const costRatio = menu.sellingPrice > 0 ? (menu.totalIngredientsCost / menu.sellingPrice * 100) : 0;
                const isOverBudget = costRatio > foodCostPercent;
                return (
                <div key={menu.id} className="bg-[#DEDEE4] rounded-3xl shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] overflow-hidden hover:shadow-[0_18px_44px_rgba(0,0,0,0.32)] transition-all">
                  {/* 卡片頂部 */}
                  <div className="px-6 pt-6 pb-4 flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-3">
                      <h4 className="text-lg font-black text-black tracking-tight truncate">{menu.name}</h4>
                      <p className="text-xs text-[#6B6B76] font-bold mt-1">食材成本 <span className="text-black">${menu.totalIngredientsCost.toFixed(1)}</span></p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => askConfirm({ title: `刪除商品「${menu.name}」？`, message: '會從售價金額中移除這個商品。', onConfirm: () => setSetMenus(prev => prev.filter(m => m.id !== menu.id)) })} className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {/* 建議售價 — 主視覺 */}
                  <div className="mx-5 bg-[#111111] rounded-2xl px-5 py-4 flex justify-between items-center">
                    <span className="text-xs text-neutral-500 font-bold shrink-0">建議售價</span>
                    <div className="text-right min-w-0">
                      <span className="text-2xl font-black text-white">${menu.roundedPrice}</span>
                      <span className="text-[11px] text-neutral-500 font-bold ml-1.5 hidden sm:inline">(${menu.suggestedPrice.toFixed(0)})</span>
                    </div>
                  </div>

                  {/* 底部資訊 */}
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-[#6B6B76] font-bold">終端售價</span>
                      <div className="flex items-center">
                        <span className="text-[#6B6B76] text-sm mr-0.5">$</span>
                        <input 
                          type="number" min="0" value={menu.sellingPrice || 0}
                          onChange={e => setSetMenus(prev => prev.map(m => m.id === menu.id ? { ...m, sellingPrice: parseFloat(e.target.value) || 0 } : m))}
                          className="font-black text-black text-base bg-transparent outline-none w-16 text-right focus:bg-[#F5F5F5] rounded-lg px-1 py-0.5 transition-colors"
                        />
                      </div>
                    </div>
                    {menu.sellingPrice > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#6B6B76] font-bold">食材佔比</span>
                        <span className={`text-sm font-black ${isOverBudget ? 'text-red-500' : 'text-emerald-600'}`}>
                          {costRatio.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 單品食材建議售價區塊 */}
        <div>
          <h3 className="text-xl font-black text-black tracking-tight mb-5 flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center"><Scale size={14} className="text-white" /></div>
            食材單位售價參考
          </h3>
          <div className="bg-white rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="px-6 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest">食材名稱</th>
                    <th className="px-6 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest">分類</th>
                    <th className="px-6 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">食材成本</th>
                    <th className="px-6 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">建議售價</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientPricingData.map((item, idx) => (
                    <tr key={item.id + '-' + idx} className="border-b border-neutral-50 hover:bg-[#F9F9F9] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.code && <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">{item.code}</span>}
                          <div>
                            <span className="font-black text-black text-sm">{item.name}</span>
                            <span className="block text-[10px] text-[#5F5F68] font-bold mt-0.5">{item.vendorName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-[#5F5F68] bg-[#F5F5F5] px-3 py-1 rounded-full">{item.categoryName}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-black">${typeof item.finalCost === 'number' ? item.finalCost.toFixed(1) : item.finalCost}</span>
                        <span className="text-xs text-[#5F5F68] font-medium ml-1">/{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-black text-lg">${item.suggestedPrice.toFixed(1)}</span>
                        <span className="text-xs text-[#5F5F68] font-medium ml-1">/{item.unit}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ingredientPricingData.length === 0 && (
              <div className="text-center py-16 text-[#5F5F68] font-medium">
                尚無食材資料，請先到「食材成本」新增食材。
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderIngredientsTab = () => {
    const storeNameOf = (id) => (stores.find(st => st.id === id) || {}).name || '（已刪除的門店）';
    const fmtMonth = (m) => { const [y, mo] = m.split('-'); return `${y} 年 ${parseInt(mo, 10)} 月`; };
    const productNameOf = (r) => (setMenus.find(m => m.id === r.menuId) || {}).name || r.menuName;
    const fmtCost = (v) => (v < 1 ? v.toFixed(4) : v.toFixed(2));

    const monthChoices = Array.from(new Set(monthlyPrices.map(r => r.month))).sort().reverse();
    const recCategoryOf = (r) => { const m = setMenus.find(x => x.id === r.menuId); return (m && m.menuCategory) || (!m && r.category) || '未分類'; };
    const isCalced = (r) => costCalcs.some(c => c.recordId === r.id);
    const baseFiltered = monthlyPrices.filter(r => (!costMonthFilter || r.month === costMonthFilter) && (!costStoreFilter || r.storeId === costStoreFilter));
    const catChoices = Array.from(new Set(monthlyPrices.map(recCategoryOf))).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const todoCount = baseFiltered.filter(r => (!costCatFilter || recCategoryOf(r) === costCatFilter) && !isCalced(r)).length;
    const pickable = baseFiltered
      .filter(r => (!costCatFilter || recCategoryOf(r) === costCatFilter) && (!costStatusFilter || (costStatusFilter === 'todo' ? !isCalced(r) : isCalced(r))))
      .sort((a, b) => b.month.localeCompare(a.month) || productNameOf(a).localeCompare(productNameOf(b), 'zh-Hant'));
    const picked = monthlyPrices.find(r => r.id === costPickId) || null;
    const savedForPicked = picked ? costCalcs.find(c => c.recordId === picked.id) : null;

    const num = (v) => (v === '' || v === null || v === undefined ? NaN : parseFloat(v));
    const price = num(costForm.price);
    const weight = num(costForm.weight);
    const yieldPct = num(costForm.yieldRate);
    const taxPct = num(costForm.taxRate);
    const unit = (costForm.weightUnit || '').trim() || '單位';
    const result = calcCost(price, weight, yieldPct, taxPct);

    const locked = !!savedForPicked && !calcEditing;
    const handleCancelEdit = () => {
      if (savedForPicked) setCostForm({ price: savedForPicked.price, weight: savedForPicked.weight, weightUnit: savedForPicked.weightUnit, yieldRate: savedForPicked.yieldRate, yieldNote: savedForPicked.yieldNote || '', taxRate: savedForPicked.taxRate });
      setCalcEditing(false); setUnitPanel({ ...unitPanel, open: false });
    };
    const handlePick = (r) => {
      setCalcEditing(false);
      setCostPickId(r.id);
      const saved = costCalcs.find(c => c.recordId === r.id);
      setCostForm(saved
        ? { price: saved.price, weight: saved.weight, weightUnit: saved.weightUnit, yieldRate: saved.yieldRate, yieldNote: saved.yieldNote || '', taxRate: saved.taxRate }
        : { price: r.price, weight: '', weightUnit: 'g', yieldRate: '', yieldNote: '', taxRate: globalSettings.taxRate });
    };

    const handleSaveCalc = () => {
      if (!picked || result === null) { showNotice('error', '請完整輸入售價、重量、可用重量與營業稅。'); return; }
      const entry = {
        id: savedForPicked ? savedForPicked.id : newUid(), recordId: picked.id,
        menuName: productNameOf(picked), category: picked.category, storeName: storeNameOf(picked.storeId), month: picked.month,
        price, weight, weightUnit: unit, yieldRate: yieldPct, yieldNote: (costForm.yieldNote || '').trim(), taxRate: taxPct
      };
      setCostCalcs(prev => savedForPicked ? prev.map(c => c.id === entry.id ? entry : c) : [...prev, entry]);
      setCalcEditing(false);
      showNotice('success', `已儲存「${entry.menuName}」的食材成本。`);
    };

    const handleDeleteCalc = (c) => {
      askConfirm({ title: `刪除「${c.menuName}」食材成本？`, message: '已加入商品計算的單品會保留最後儲存的成本。', onConfirm: () => setCostCalcs(prev => prev.filter(x => x.id !== c.id)) });
    };

    const inputCls = 'w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold transition-all disabled:bg-[#ECECF0] disabled:text-neutral-600 disabled:cursor-not-allowed';
    const labelCls = 'block text-xs font-bold text-[#5F5F68] mb-2 tracking-widest uppercase';
    const setField = (key, value) => setCostForm({ ...costForm, [key]: value });
    // 單位清單：目前選用但已不在清單內的單位（例如舊紀錄）仍會顯示
    const unitList = Array.from(new Set([...units, costForm.weightUnit].filter(Boolean)));

    const handleAddUnit = () => {
      const name = unitPanel.newName.trim();
      if (!name) { showNotice('error', '請輸入單位名稱。'); return; }
      if (!units.includes(name)) {
        setUnits(prev => [...prev, name]);
        showNotice('success', `已新增單位「${name}」。`);
      }
      setCostForm({ ...costForm, weightUnit: name });
      setUnitPanel({ ...unitPanel, newName: '' });
    };

    const handleRenameUnit = (oldName) => {
      const input = window.prompt('請輸入新的單位名稱：', oldName);
      if (input === null) return;
      const name = input.trim();
      if (!name || name === oldName) return;
      if (units.includes(name)) { showNotice('error', '已有同名單位。'); return; }
      setUnits(prev => prev.map(u => (u === oldName ? name : u)));
      setCostCalcs(prev => prev.map(c => (c.weightUnit === oldName ? { ...c, weightUnit: name } : c)));
      if (costForm.weightUnit === oldName) setCostForm({ ...costForm, weightUnit: name });
    };

    const handleDeleteUnit = (name) => {
      if (units.length <= 1) { showNotice('error', '至少要保留一個單位。'); return; }
      askConfirm({ title: `刪除單位「${name}」？`, message: '已儲存的食材成本不受影響。', onConfirm: () => {
        const rest = units.filter(u => u !== name);
        setUnits(rest);
        if (costForm.weightUnit === name) setCostForm({ ...costForm, weightUnit: rest[0] });
      } });
    };

    return (
      <div className="animate-in fade-in duration-500 pb-24 md:pb-8">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-black tracking-tight">{texts.tabIngredients}</h2>
          <p className="text-[#5F5F68] font-medium text-sm mt-2 tracking-wide">先選擇「每月售價」登錄的食材，再輸入重量、可用重量與營業稅，試算食材成本。</p>
        </div>

        {/* 步驟 1：選擇每月售價登錄的食材 */}
        <div className="bg-[#DEDEE4] p-6 md:p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
          <h3 className="font-black text-lg text-black mb-5 flex items-center gap-3">
            <div className="p-2 bg-[#F5F5F5] rounded-full"><CalendarDays size={20} className="text-black" /></div>
            1. 選擇食材
          </h3>
          {monthlyPrices.length === 0 ? (
            <div className="text-center py-12 bg-[#F5F5F5] rounded-[24px]">
              <p className="text-red-600 font-bold mb-4">「{texts.tabMonthlyPrice || '每月售價'}」還沒有登錄任何食材。</p>
              <button onClick={() => setCurrentTab('monthlyPrice')} className="bg-black hover:bg-neutral-800 text-white px-6 py-3 rounded-full font-bold text-sm transition-all">前往「{texts.tabMonthlyPrice || '每月售價'}」登錄</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className={labelCls}>月份</label>
                  <select value={costMonthFilter} onChange={(e) => setCostMonthFilter(e.target.value)} className={inputCls}>
                    <option value="">全部月份</option>
                    {monthChoices.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>門店</label>
                  <select value={costStoreFilter} onChange={(e) => setCostStoreFilter(e.target.value)} className={inputCls}>
                    <option value="">全部門店</option>
                    {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>商品分類</label>
                  <select value={costCatFilter} onChange={(e) => setCostCatFilter(e.target.value)} className={inputCls} aria-label="商品分類">
                    <option value="">全部分類</option>
                    {catChoices.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>試算狀態</label>
                  <select value={costStatusFilter} onChange={(e) => setCostStatusFilter(e.target.value)} className={`${inputCls} ${costStatusFilter === 'todo' ? '!text-red-600' : ''}`} aria-label="試算狀態">
                    <option value="">全部狀態</option>
                    <option value="todo">尚未試算（{todoCount}）</option>
                    <option value="done">已試算</option>
                  </select>
                </div>
              </div>
              {pickable.length === 0 ? (
                <p className="text-red-600 font-bold text-sm py-6">這個條件下沒有任何食材。</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {pickable.map(r => {
                    const active = r.id === costPickId;
                    const done = costCalcs.some(c => c.recordId === r.id);
                    return (
                      <button
                        key={r.id} onClick={() => handlePick(r)} aria-pressed={active}
                        className={`text-left p-4 rounded-[20px] border transition-all ${active ? 'bg-black text-white border-black' : 'bg-white border-neutral-200 hover:border-black'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-black text-xl leading-tight tracking-tight">{productNameOf(r)}</span>
                          <span className="font-black text-base shrink-0">${r.price}</span>
                        </div>
                        <p className={`text-[11px] font-bold mt-1.5 ${active ? 'text-neutral-400' : 'text-[#5F5F68]'}`}>
                          {storeNameOf(r.storeId)} · {r.category} · {fmtMonth(r.month)}
                        </p>
                        {done
                          ? <span className={`inline-block mt-2 text-[10px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white text-black' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>已試算</span>
                          : <span className="blink-red inline-block mt-2 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-red-500 text-white border border-red-600">尚未試算</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* 步驟 2：輸入並試算 */}
        {picked && (
          <div className="bg-[#DEDEE4] p-6 md:p-8 rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] mb-8">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-black text-lg text-black mb-1 flex items-center gap-3">
                <div className="p-2 bg-[#F5F5F5] rounded-full"><Calculator size={20} className="text-black" /></div>
                2. 試算「{productNameOf(picked)}」
              </h3>
              {savedForPicked && (calcEditing
                ? <button onClick={handleCancelEdit} className="shrink-0 flex items-center gap-1.5 bg-white border border-[#B4B4BE] hover:border-black text-black px-4 py-2 rounded-full font-bold text-sm transition-colors"><X size={14} /> 取消編輯</button>
                : <button onClick={() => setCalcEditing(true)} aria-label="編輯食材成本" title="編輯" className="shrink-0 flex items-center gap-1.5 bg-black hover:bg-neutral-800 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors"><Pencil size={14} /> 編輯</button>)}
            </div>
            <p className="text-xs font-bold text-[#5F5F68] mb-6 ml-12">{storeNameOf(picked.storeId)} · {fmtMonth(picked.month)}</p>
            {locked && <p className="text-xs font-bold text-red-600 mb-5 -mt-3 ml-12">此商品已儲存，如需修改內容請按右上角「編輯」（鉛筆）。</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
              <div>
                <label className={labelCls}>售價 ($)</label>
                <input type="number" min="0" step="any" value={costForm.price} disabled={locked} onChange={(e) => setField('price', e.target.value)} className={inputCls} placeholder="0" />
                <p className="text-[11px] text-red-600 font-bold mt-2">已帶入每月售價，可自行修改</p>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="cost-unit" className="text-xs font-bold text-[#5F5F68] tracking-widest uppercase">單位</label>
                    <button type="button" disabled={locked} onClick={() => setUnitPanel({ ...unitPanel, open: !unitPanel.open })} className="disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold text-[#5F5F68] hover:text-black flex items-center gap-1 transition-colors">
                      <Edit2 size={12} /> {unitPanel.open ? '完成' : '新增 / 編輯單位'}
                    </button>
                  </div>
                  <select id="cost-unit" value={costForm.weightUnit} disabled={locked} onChange={(e) => setField('weightUnit', e.target.value)} className={`${inputCls} h-[52px]`}>
                    {unitList.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {unitPanel.open && (
                    <div className="mt-3 bg-[#F5F5F5] rounded-[20px] p-4">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {units.map(u => (
                          <span key={u} className="inline-flex items-center bg-white border border-neutral-200 rounded-full pl-3 pr-1 py-1 text-sm font-bold text-black">
                            {u}
                            <button type="button" onClick={() => handleRenameUnit(u)} aria-label={`重新命名單位 ${u}`} className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-black hover:bg-[#F5F5F5] transition-colors"><Edit2 size={12} /></button>
                            <button type="button" onClick={() => handleDeleteUnit(u)} aria-label={`刪除單位 ${u}`} className="w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><X size={12} /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text" value={unitPanel.newName} onChange={(e) => setUnitPanel({ ...unitPanel, newName: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddUnit(); }}
                          placeholder="輸入新單位，例如：條" aria-label="新增單位名稱"
                          className="flex-1 min-w-0 bg-white border border-neutral-200 rounded-full px-4 py-2.5 text-black outline-none focus:ring-2 focus:ring-black font-bold text-sm"
                        />
                        <button type="button" onClick={handleAddUnit} className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-1.5 transition-all shrink-0"><Plus size={14} strokeWidth={3} /> 新增</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>重量</label>
                  <input type="number" min="0" step="any" value={costForm.weight} disabled={locked} onChange={(e) => setField('weight', e.target.value)} className={`${inputCls} h-[52px]`} placeholder="例如 1000" />
                </div>
              </div>
              <div>
                <label className={labelCls}>可用重量 (%)</label>
                <input type="number" min="0" max="100" step="any" value={costForm.yieldRate} disabled={locked} onChange={(e) => setField('yieldRate', e.target.value)} className={inputCls} placeholder="例如 85" />
                <p className="text-[11px] text-red-600 font-bold mt-2">填可用比例：85 代表 重量 × 85%</p>
                <AutoText value={costForm.yieldNote || ''} disabled={locked} maxLength={500} onChange={(e) => setField('yieldNote', e.target.value)} className={`${inputCls} !h-auto min-h-[52px] leading-relaxed mt-3 text-sm`} placeholder="算法說明，例如：去骨後剩 85%" aria-label="耗損算法說明" />
              </div>
              <div>
                <label className={labelCls}>營業稅 (%)</label>
                <input type="number" min="0" step="any" value={costForm.taxRate} disabled={locked} onChange={(e) => setField('taxRate', e.target.value)} className={inputCls} placeholder="例如 5" />
                <p className="text-[11px] text-red-600 font-bold mt-2">填 5 代表 × 1.05</p>
              </div>
            </div>

            <div className="mt-8 bg-[#111111] rounded-[24px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="min-w-0">
                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">計算式　售價 ÷（重量 × 可用重量）× 營業稅</span>
                <p className="text-sm font-bold text-neutral-300 break-words">
                  {result === null
                    ? '請完整輸入售價、重量、可用重量與營業稅（重量與可用重量需大於 0）。'
                    : `$${price} ÷（${weight}${unit} × ${yieldPct}%）× (1 + ${taxPct}%)`}
                </p>
              </div>
              <div className="md:text-right shrink-0">
                <span className="block text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">食材成本</span>
                <span className="text-3xl font-black text-white">{result === null ? '—' : <>${fmtCost(result)}<span className="text-sm text-neutral-500 font-medium ml-1">/{unit}</span></>}</span>
              </div>
            </div>

            <div className={`flex justify-end mt-6 ${locked ? 'hidden' : ''}`}>
              <button onClick={handleSaveCalc} disabled={result === null} className="bg-black hover:bg-neutral-800 disabled:bg-[#F5F5F5] disabled:text-neutral-400 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all">
                <Save size={16} /> {savedForPicked ? '更新食材成本' : '儲存食材成本'}
              </button>
            </div>
          </div>
        )}

        {/* 已儲存的食材成本 */}
        <h3 className="text-xl font-black text-black tracking-tight mb-5">已儲存的食材成本 <span className="text-[#5F5F68] text-sm font-bold ml-2">共 {costCalcs.length} 筆</span></h3>
        {costCalcs.length === 0 ? (
          <div className="text-center py-16 text-red-600 font-bold rounded-[32px] bg-[#F5F5F5]">尚未儲存任何食材成本。</div>
        ) : (
          <div className="bg-white rounded-[32px] shadow-[0_12px_32px_rgba(0,0,0,0.22)] border border-[#B4B4BE] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="px-6 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest">食材</th>
                    <th className="px-4 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">售價</th>
                    <th className="px-4 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">重量</th>
                    <th className="px-4 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">可用重量</th>
                    <th className="px-4 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">營業稅</th>
                    <th className="px-6 py-4 text-[10px] text-[#5F5F68] font-bold uppercase tracking-widest text-right">食材成本</th>
                    <th className="px-3 py-4 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...costCalcs].sort((a, b) => b.month.localeCompare(a.month) || a.menuName.localeCompare(b.menuName, 'zh-Hant')).map(c => {
                    const cost = calcCost(c.price, c.weight, c.yieldRate, c.taxRate);
                    const recordAlive = monthlyPrices.some(r => r.id === c.recordId);
                    return (
                      <tr key={c.id} className="border-b border-neutral-50 hover:bg-[#F9F9F9] transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-black text-black text-sm">{c.menuName}</span>
                          <span className="block text-[10px] text-[#5F5F68] font-bold mt-0.5">{c.storeName} · {fmtMonth(c.month)}</span>
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-black text-sm">${c.price}</td>
                        <td className="px-4 py-4 text-right font-bold text-black text-sm">{c.weight}{c.weightUnit}</td>
                        <td className="px-4 py-4 text-right font-bold text-black text-sm">{c.yieldRate}%{c.yieldNote && <span className="block text-[10px] text-[#5F5F68] font-medium mt-0.5 max-w-[240px] ml-auto break-words whitespace-pre-wrap">{c.yieldNote}</span>}</td>
                        <td className="px-4 py-4 text-right font-bold text-black text-sm">{c.taxRate}%</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-black text-black text-lg">{cost === null ? '—' : `$${fmtCost(cost)}`}</span>
                          <span className="text-xs text-[#5F5F68] font-medium ml-1">/{c.weightUnit}</span>
                        </td>
                        <td className="px-3 py-4 text-right whitespace-nowrap">
                          {recordAlive && <button onClick={() => { const r = monthlyPrices.find(x => x.id === c.recordId); if (r) { handlePick(r); setCalcEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} title="編輯" className="p-2 text-neutral-300 hover:text-black hover:bg-[#F5F5F5] rounded-xl transition-colors"><Edit2 size={15} /></button>}
                          <button onClick={() => handleDeleteCalc(c)} title="刪除" className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNotesFab = () => {
    const fmtTime = (t) => { try { const d = new Date(t); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}/${z(d.getMonth() + 1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; } catch (e) { return ''; } };
    const handleAddNote = () => {
      const text = noteDraft.trim();
      if (!text) { showNotice('error', '請先輸入事項內容。'); return; }
      const now = Date.now();
      setNotes(prev => [{ id: `n-${newUid()}`, text, createdAt: now, updatedAt: now }, ...prev]);
      setNoteDraft('');
    };
    const handleSaveNote = () => {
      if (!editingNote) return;
      const text = editingNote.text.trim();
      if (!text) { showNotice('error', '事項內容不能是空白。'); return; }
      setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, text, updatedAt: Date.now() } : n));
      setEditingNote(null);
    };
    const handleDeleteNote = (n) => askConfirm({ title: '刪除這則事項？', message: n.text.length > 40 ? n.text.slice(0, 40) + '…' : n.text, onConfirm: () => setNotes(prev => prev.filter(x => x.id !== n.id)) });
    const closeNotes = () => { setNotesOpen(false); setEditingNote(null); };
    const stackBottom = currentTab === 'monthlyPrice' ? 'bottom-[13rem] md:bottom-36' : 'bottom-24 md:bottom-8';
    return (
      <>
        {notesOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 md:p-6 bg-black/50" onClick={closeNotes}>
            <div role="dialog" aria-label="記事本" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-[28px] border border-[#B4B4BE] shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden">
              <div className="p-5 pb-4 border-b border-[#D4D4DC] bg-[#DEDEE4]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-black text-xl text-black flex items-center gap-2"><StickyNote size={20} /> 記事本 <span className="text-[#5F5F68] text-sm font-bold">共 {notes.length} 則</span></h3>
                  <button onClick={closeNotes} aria-label="關閉記事本" className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-neutral-200 transition-colors"><X size={16} /></button>
                </div>
                <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }} rows={2} placeholder="輸入要記錄的事項…（Ctrl + Enter 快速新增）" aria-label="事項內容" className="w-full text-left bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold resize-y" />
                <div className="flex justify-end mt-3">
                  <button onClick={handleAddNote} className="bg-black hover:bg-neutral-800 text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all"><Plus size={16} /> 新增</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
                {notes.length === 0 ? (
                  <div className="text-center py-12 text-red-600 font-bold rounded-[24px] bg-[#F5F5F5]">還沒有任何事項。</div>
                ) : (
                  <div className="space-y-3">
                    {notes.map(n => (
                      <div key={n.id} className="text-left bg-white rounded-[20px] p-4 border border-[#B4B4BE] shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
                        {editingNote && editingNote.id === n.id ? (
                          <>
                            <textarea autoFocus value={editingNote.text} onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') setEditingNote(null); }} rows={4} aria-label="編輯事項" className="w-full bg-white border border-[#B4B4BE] rounded-[16px] px-4 py-3 text-black outline-none focus:ring-2 focus:ring-black font-bold resize-y" />
                            <div className="flex justify-end gap-3 mt-3">
                              <button onClick={() => setEditingNote(null)} className="px-5 py-2.5 rounded-full bg-[#F5F5F5] hover:bg-neutral-200 text-black font-bold text-sm transition-colors">取消</button>
                              <button onClick={handleSaveNote} className="px-5 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white font-bold text-sm transition-colors">儲存</button>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-base whitespace-pre-wrap break-words leading-relaxed text-black">{n.text}</p>
                              <p className="text-[11px] text-[#5F5F68] font-bold mt-2">{fmtTime(n.createdAt)}{n.updatedAt && n.updatedAt !== n.createdAt ? `（已編輯 ${fmtTime(n.updatedAt)}）` : ''}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => setEditingNote({ id: n.id, text: n.text })} aria-label="編輯事項" className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"><Pencil size={16} /></button>
                              <button onClick={() => handleDeleteNote(n)} aria-label="刪除事項" className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setNotesOpen(true)} aria-label="記事本" className={`fixed z-[140] right-3 md:right-6 ${stackBottom} flex items-center gap-2 bg-black hover:bg-neutral-800 text-white pl-4 pr-5 py-3.5 rounded-full font-black text-sm shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors`}>
          <StickyNote size={18} /> 記事本
        </button>
      </>
    );
  };

  const navItems = [
    { id: 'monthlyPrice', icon: <CalendarDays size={20} strokeWidth={2} />, label: texts.tabMonthlyPrice || '每月售價' },
    { id: 'ingredients', icon: <Layers size={20} strokeWidth={2} />, label: texts.tabIngredients },
    { id: 'setMenus', icon: <Utensils size={20} strokeWidth={2} />, label: texts.tabSetMenus },
    { id: 'sellingPrice', icon: <Tag size={20} strokeWidth={2} />, label: texts.tabSellingPrice || '售價金額' },
    { id: 'settings', icon: <Settings size={20} strokeWidth={2} />, label: texts.tabSettings },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black flex font-sans selection:bg-neutral-200">
      <aside className="hidden md:flex flex-col w-[280px] bg-white fixed h-full z-40 border-r border-neutral-100 shadow-[10px_0_30px_rgba(0,0,0,0.02)]">
        <button onClick={openUIEditor} className="p-8 flex items-center gap-4 hover:bg-neutral-50 transition-colors w-full text-left group">
          <div className="w-10 h-10 bg-black rounded-[14px] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0"><Calculator className="w-5 h-5 text-white" strokeWidth={2} /></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-black tracking-tighter uppercase truncate">{globalSettings.systemName || 'FINERP'}</h1>
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">點擊修改設定</span>
          </div>
        </button>
        
        <nav className="flex-1 px-6 space-y-3 mt-4">
          <p className="px-2 text-[10px] font-bold text-[#5F5F68] uppercase tracking-[0.2em] mb-4">{texts.sidebarMenu}</p>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setCurrentTab(item.id); setSearchQuery(''); }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-[20px] font-bold transition-all text-sm tracking-wide ${
                currentTab === item.id 
                ? 'bg-black text-white shadow-[0_10px_20px_rgba(0,0,0,0.1)]' 
                : 'text-[#5F5F68] hover:bg-[#F5F5F5] hover:text-black'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-6 space-y-3">
          {/* 狀態卡 */}
          <div className="bg-[#F5F5F5] p-4 rounded-2xl">
             <div className="flex items-center gap-2 text-xs font-black text-black">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               {texts.statusText}
             </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <header className="bg-[#F5F5F5]/80 backdrop-blur-xl sticky top-0 z-30 px-4 py-4 md:px-10 md:py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            
            <div className="flex md:hidden justify-between items-center w-full bg-white p-4 rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.16)] border border-[#B4B4BE]">
              <button onClick={openUIEditor} className="flex items-center gap-3 w-fit text-left active:scale-95 transition-transform group">
                <div className="w-8 h-8 bg-black rounded-[10px] flex items-center justify-center shrink-0"><Calculator className="w-4 h-4 text-white" /></div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black text-black tracking-tighter uppercase truncate max-w-[150px]">{globalSettings.systemName || 'FINERP'}</h1>
                  <span className="text-[8px] text-neutral-400 font-bold block -mt-0.5 leading-none uppercase">介面文字設定</span>
                </div>
              </button>
            </div>

            <div className="flex-1 flex items-center gap-4 w-full justify-between sm:justify-end">
              {currentTab !== 'settings' && currentTab !== 'monthlyPrice' && currentTab !== 'ingredients' && currentTab !== 'setMenus' && currentTab !== 'notes' && (
                <div className="relative w-full sm:max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-[#5F5F68]" />
                  </div>
                  <input
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-12 pr-5 py-3.5 bg-white border border-[#B4B4BE] shadow-[0_8px_24px_rgba(0,0,0,0.16)] rounded-full text-black placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black transition-all font-bold text-sm"
                    placeholder="搜尋食材或分類..."
                  />
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:px-10 md:pb-10 max-w-6xl mx-auto w-full">
          {currentTab === 'monthlyPrice' && renderMonthlyPriceTab()}
          {currentTab === 'ingredients' && renderIngredientsTab()}
          {currentTab === 'setMenus' && renderSetMenuTab()}
          {currentTab === 'sellingPrice' && renderSellingPriceTab()}
          {currentTab === 'settings' && renderSettingsTab()}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-black/95 backdrop-blur-xl rounded-[32px] z-50 shadow-[0_20px_40px_rgba(0,0,0,0.15)]">
        <div className="flex justify-around items-center p-2">
          {navItems.map(item => (
             <button 
               key={item.id}
               onClick={() => { setCurrentTab(item.id); setSearchQuery(''); }}
               className={`flex flex-col items-center justify-center transition-all w-full py-3 px-2 rounded-[24px] ${currentTab === item.id ? 'bg-white text-black' : 'text-neutral-500'}`}
             >
               <div className="mb-1">{item.icon}</div>
               <span className="text-[10px] font-black tracking-widest uppercase">{item.label}</span>
             </button>
          ))}
        </div>
      </nav>

      {renderUIEditor()}
      <style>{'@keyframes blinkRed{0%,100%{opacity:1}50%{opacity:.2}} .blink-red{animation:blinkRed 1s ease-in-out infinite}'}</style>
      {renderToast()}
      {renderPriceFab()}
      {renderPriceChange()}
      {renderNotesFab()}
      {renderCostDetailModal()}
      {renderConfirmDialog()}

    </div>
  );
}
