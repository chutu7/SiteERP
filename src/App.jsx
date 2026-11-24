import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, PackagePlus, Truck, CheckSquare, Wifi, WifiOff,
  RefreshCw, Camera, Plus, Trash2, LogOut, Send, CheckCircle2, XCircle,
  Printer, FileText, KeyRound, Pencil
} from 'lucide-react';
import { PrintA4Modal, ChangePasswordModal, SEPITECH_LOGO_URL } from './PrintModals';

// ============================================================================
// DÁN LINK WEB APP (/exec) CỦA BẠN VÀO ĐÂY
// ============================================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwriVW3kMvXAeHEcBEkZ3pYrSSiTAsgWBsYzdhr6MENUirrO2Isp3IW2IsDaGuXCmZ2/exec';

const FALLBACK_DB = {
  duAn: [
    { Ma_Du_An: 'CAU_GP9', Ten_Du_An: 'Cầu Gò Dầu - Phước Đông 9', Dia_Diem: 'Tây Ninh' },
    { Ma_Du_An: 'SBLT', Ten_Du_An: 'Sân Bay Long Thành 4.8', Dia_Diem: 'Đồng Nai' },
    { Ma_Du_An: 'KHO_TONG', Ten_Du_An: 'Kho Tổng Công Ty', Dia_Diem: 'TP.HCM' }
  ],
  vatTu: [
    { Ma_Vat_Tu: 'THEP-D16-CB400', Ten_Vat_Tu: 'Thép thanh vằn D16 CB400-V', Don_Vi_Tinh: 'kg' },
    { Ma_Vat_Tu: 'CAP-DUL-15.2', Ten_Vat_Tu: 'Cáp dự ứng lực 15.24mm', Don_Vi_Tinh: 'met' }
  ],
  thietBi: [
    { Ma_Thiet_Bi: 'MM-KICHDON-YQC25', Ten_Thiet_Bi: 'Kích đơn kéo cáp YQC25', Vi_Tri_Hien_Tai: 'CAU_GP9' },
    { Ma_Thiet_Bi: 'TH-I600-12M', Ten_Thiet_Bi: 'Thép hình I600 dài 12m', Vi_Tri_Hien_Tai: 'SBLT' }
  ],
  nguoiDung: [
    { Ma_NV: 'NV01', Ho_Ten: 'Nguyễn Văn A (Kỹ sư)', Ma_PIN: '1111', Vai_Tro: 'KY_SU', Du_An_Phu_Trach: 'CAU_GP9,SBLT' },
    { Ma_NV: 'NV04', Ho_Ten: 'Phạm Hồng Đức (Giám đốc)', Ma_PIN: '9999', Vai_Tro: 'GIAM_DOC', Du_An_Phu_Trach: 'KHO_TONG,CAU_GP9,SBLT' }
  ],
  giaoDichGanDay: [],
  nhatKyGanDay: []
};

const toCodeNoDiacritics = (str) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toUpperCase();

const compressAndWatermarkImage = (file, watermarkText) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const scale = MAX_WIDTH / img.width;
        canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        canvas.height = img.width > MAX_WIDTH ? img.height * scale : img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(watermarkText, 12, canvas.height - 13);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [masterData, setMasterData] = useState(() => {
    const saved = localStorage.getItem('erp_master_data');
    return saved ? JSON.parse(saved) : FALLBACK_DB;
  });
  const [offlineQueue, setOfflineQueue] = useState(() => {
    const saved = localStorage.getItem('erp_offline_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('erp_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('NHAT_KY');
  const [selectedProject, setSelectedProject] = useState('');
  const [toast, setToast] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [showChangePass, setShowChangePass] = useState(false);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    fetchMasterData();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (currentUser && !selectedProject) {
      const allowed = currentUser.Du_An_Phu_Trach.split(',').map((s) => s.trim());
      setSelectedProject(allowed[0] || 'CAU_GP9');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('erp_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMasterData = async () => {
    if (!navigator.onLine || API_URL.includes('DIEN_MA_DEPLOY')) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_URL}?action=getInitData`);
      const json = await res.json();
      if (json.status === 'success') {
        setMasterData(json);
        localStorage.setItem('erp_master_data', JSON.stringify(json));
      }
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const submitAction = async (action, payload) => {
    const reqItem = { id: Date.now(), action, payload, createdAt: new Date().toLocaleTimeString('vi-VN') };
    if (!isOnline || API_URL.includes('DIEN_MA_DEPLOY')) {
      setOfflineQueue((prev) => [...prev, reqItem]);
      showToast('Đang mất mạng: Đã lưu phiếu vào bộ nhớ máy!', 'warning');
      return true;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast('Đã đồng bộ lên hệ thống thành công!');
        fetchMasterData();
        return true;
      }
      throw new Error(json.message);
    } catch {
      setOfflineQueue((prev) => [...prev, reqItem]);
      showToast('Mạng yếu: Đã lưu tạm vào hàng đợi để gửi sau!', 'warning');
      return true;
    } finally { setIsSyncing(false); }
  };

  const flushOfflineQueue = async () => {
    if (!isOnline) return showToast('Vẫn chưa có kết nối Internet!', 'error');
    if (offlineQueue.length === 0) return;
    setIsSyncing(true);
    const remaining = [];
    for (const item of offlineQueue) {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: item.action, payload: item.payload })
        });
        const json = await res.json();
        if (json.status !== 'success') remaining.push(item);
      } catch { remaining.push(item); }
    }
    setOfflineQueue(remaining);
    setIsSyncing(false);
    if (remaining.length === 0) {
      showToast('Đã đồng bộ 100% phiếu ngoại tuyến lên Google Sheets!');
      fetchMasterData();
    } else showToast(`Còn ${remaining.length} phiếu chưa gửi được.`, 'warning');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const targetMaNV = selectedUserId || (masterData.nguoiDung[0]?.Ma_NV || '');
    const user = masterData.nguoiDung.find((u) => u.Ma_NV === targetMaNV && String(u.Ma_PIN).trim() === pinInput.trim());
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('erp_current_user', JSON.stringify(user));
      setPinInput('');
    } else showToast('Sai mật khẩu / mã PIN của nhân sự này!', 'error');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('erp_current_user');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-center mb-3">
            <img src={SEPITECH_LOGO_URL} alt="SEPITECH" className="w-16 h-16 object-contain rounded-xl border border-slate-100 shadow-sm" />
          </div>
          <h1 className="text-lg font-bold text-center text-slate-800 uppercase">SEPITECH - QUẢN LÝ CÔNG TRƯỜNG</h1>
          <p className="text-xs text-center text-slate-500 mt-1 mb-5">Chọn tên nhân sự và nhập mật khẩu để truy cập</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Tài khoản nhân sự</label>
              <select
                value={selectedUserId || (masterData.nguoiDung[0]?.Ma_NV || '')}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 bg-white focus:border-blue-800 outline-none"
              >
                {masterData.nguoiDung.map((u) => (
                  <option key={u.Ma_NV} value={u.Ma_NV}>{u.Ho_Ten} ({u.Vai_Tro})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Mật khẩu / Mã PIN</label>
              <input
                type="password" inputMode="numeric" placeholder="Nhập mật khẩu..." value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center text-xl tracking-widest font-bold border-2 border-slate-200 rounded-xl py-2.5 focus:border-blue-800 outline-none"
                autoFocus
              />
            </div>
            <button type="submit" className="w-full bg-blue-900 text-white font-semibold py-3 rounded-xl active:scale-95 transition">Đăng nhập</button>
            <button type="button" onClick={fetchMasterData} className="w-full text-xs text-blue-700 font-medium py-1 flex items-center justify-center gap-1 hover:underline">
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> Cập nhật danh sách nhân sự từ Google Sheets
            </button>
          </form>
        </div>
      </div>
    );
  }

  const allowedProjects = masterData.duAn.filter((d) => currentUser.Du_An_Phu_Trach.split(',').map((s) => s.trim()).includes(d.Ma_Du_An));
  const canApprove = ['GIAM_DOC', 'THU_KHO'].includes(currentUser.Vai_Tro);
  const currentProjectObj = masterData.duAn.find((d) => d.Ma_Du_An === selectedProject) || { Ma_Du_An: selectedProject, Ten_Du_An: selectedProject };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 max-w-lg mx-auto shadow-lg relative">
      {printDoc && <PrintA4Modal doc={printDoc} projectInfo={currentProjectObj} onClose={() => setPrintDoc(null)} />}
      {showChangePass && (
        <ChangePasswordModal
          user={currentUser} isOnline={isOnline} apiUrl={API_URL}
          onClose={() => setShowChangePass(false)}
          onSuccess={(newPin) => {
            const updatedUser = { ...currentUser, Ma_PIN: newPin };
            setCurrentUser(updatedUser);
            localStorage.setItem('erp_current_user', JSON.stringify(updatedUser));
            fetchMasterData();
            showToast('Đổi mật khẩu thành công!');
            setShowChangePass(false);
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <header className="bg-blue-950 text-white p-3 sticky top-0 z-20 shadow no-print">
        <div className="flex justify-between items-center gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{currentUser.Ho_Ten}</span>
              <span className="text-[10px] bg-blue-800 px-2 py-0.5 rounded-full shrink-0">{currentUser.Vai_Tro}</span>
            </div>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="mt-1 bg-blue-900 text-yellow-300 font-bold text-xs rounded px-2 py-1 border border-blue-700 outline-none max-w-full">
              {allowedProjects.map((p) => (<option key={p.Ma_Du_An} value={p.Ma_Du_An}>{p.Ma_Du_An} - {p.Ten_Du_An}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {offlineQueue.length > 0 && (
              <button onClick={flushOfflineQueue} className="bg-amber-500 text-slate-950 text-xs font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 animate-pulse">
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} /> ({offlineQueue.length})
              </button>
            )}
            <button onClick={fetchMasterData} title="Làm mới" className="p-2 bg-blue-900 rounded-lg"><RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /></button>
            <button onClick={() => setShowChangePass(true)} title="Đổi mật khẩu" className="p-2 bg-blue-900 rounded-lg"><KeyRound size={16} /></button>
            <button onClick={handleLogout} title="Đăng xuất" className="p-2 bg-red-900/60 rounded-lg"><LogOut size={16} /></button>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] mt-1.5 text-slate-300">
          {isOnline ? <><Wifi size={12} className="text-emerald-400" /> Trực tuyến (Sẵn sàng đồng bộ)</> : <><WifiOff size={12} className="text-amber-400" /> Ngoại tuyến (Tự lưu vào máy)</>}
        </div>
      </header>

      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white w-11/12 max-w-md text-center no-print ${toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      <main className="p-3 no-print">
        {activeTab === 'NHAT_KY' && <DailyLogForm project={selectedProject} projectObj={currentProjectObj} user={currentUser} nhatKyList={masterData.nhatKyGanDay} onSubmit={submitAction} />}
        {activeTab === 'VAT_TU' && (
          <MaterialRequestForm
            project={selectedProject}
            user={currentUser}
            vatTuList={masterData.vatTu}
            editingTx={editingTx}
            onCancelEdit={() => setEditingTx(null)}
            onSubmit={async (action, payload) => {
              const ok = await submitAction(action, payload);
              if (ok && editingTx) setEditingTx(null);
              return ok;
            }}
          />
        )}
        {activeTab === 'THIET_BI' && <EquipmentTransferForm project={selectedProject} user={currentUser} duAnList={masterData.duAn} thietBiList={masterData.thietBi} onSubmit={submitAction} />}
        {activeTab === 'HO_SO' && (
          <DocumentArchive
            project={selectedProject}
            user={currentUser}
            nhatKyList={masterData.nhatKyGanDay}
            giaoDichList={masterData.giaoDichGanDay}
            onPrint={(type, item) => setPrintDoc({ type, item })}
            onEdit={(tx) => {
              setEditingTx(tx);
              setActiveTab('VAT_TU');
            }}
            onDelete={submitAction}
          />
        )}
        {activeTab === 'DUYET' && canApprove && <ApprovalList transactions={masterData.giaoDichGanDay} user={currentUser} onApprove={submitAction} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-slate-200 flex justify-around py-2 z-20 no-print">
        <NavButton active={activeTab === 'NHAT_KY'} onClick={() => setActiveTab('NHAT_KY')} icon={<ClipboardList size={20} />} label="Nhật ký" />
        <NavButton active={activeTab === 'VAT_TU'} onClick={() => setActiveTab('VAT_TU')} icon={<PackagePlus size={20} />} label="Vật tư" />
        <NavButton active={activeTab === 'THIET_BI'} onClick={() => setActiveTab('THIET_BI')} icon={<Truck size={20} />} label="Thiết bị" />
        <NavButton active={activeTab === 'HO_SO'} onClick={() => setActiveTab('HO_SO')} icon={<FileText size={20} />} label="In PDF" />
        {canApprove && <NavButton active={activeTab === 'DUYET'} onClick={() => setActiveTab('DUYET')} icon={<CheckSquare size={20} />} label="Duyệt" badge={masterData.giaoDichGanDay.filter((t) => t.Trang_Thai_Duyet === 'Cho_Duyet').length} />}
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center relative px-2.5 py-1 rounded-lg ${active ? 'text-blue-900 font-bold' : 'text-slate-500'}`}>
      {icon}
      <span className="text-[11px] mt-0.5">{label}</span>
      {badge > 0 && <span className="absolute top-0 right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>}
    </button>
  );
}

// ============================================================================
// FORM NHẬT KÝ THI CÔNG 4 MỤC
// ============================================================================
function DailyLogForm({ project, projectObj, user, nhatKyList, onSubmit }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [weather, setWeather] = useState({ sang: 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '' });
  const [personnel, setPersonnel] = useState({ cht: 1, cbkt: 2, cbatld: 1, doi_truong: 1, cong_nhan: 12 });
  const [equipments, setEquipments] = useState([{ ten: '', sl: 1 }]);
  const [tasks, setTasks] = useState([{ hang_muc: '', kl: '' }]);
  const [khoKhanSuCo, setKhoKhanSuCo] = useState('');
  const [existingUrls, setExistingUrls] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    const found = (nhatKyList || []).find((n) => n.Ma_Du_An === project && String(n.Ngay_Thi_Cong).startsWith(date));
    if (found) {
      try {
        const w = typeof found.Thoi_Tiet === 'string' && found.Thoi_Tiet.startsWith('{') ? JSON.parse(found.Thoi_Tiet) : { sang: found.Thoi_Tiet || 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '' };
        setWeather({ sang: 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '', ...w });
      } catch {}
      try {
        const res = typeof found.Nhan_Luc_May_Moc === 'string' ? JSON.parse(found.Nhan_Luc_May_Moc) : (found.Nhan_Luc_May_Moc || {});
        setPersonnel({ cht: res.cht ?? 1, cbkt: res.cbkt ?? (res.ky_su || 2), cbatld: res.cbatld ?? 1, doi_truong: res.doi_truong ?? 1, cong_nhan: res.cong_nhan ?? 12 });
        setEquipments(Array.isArray(res.thiet_bi) && res.thiet_bi.length > 0 ? res.thiet_bi : [{ ten: res.may || '', sl: 1 }]);
      } catch {}
      try {
        const t = typeof found.Cong_Viec_Thuc_Hien === 'string' ? JSON.parse(found.Cong_Viec_Thuc_Hien) : found.Cong_Viec_Thuc_Hien;
        if (Array.isArray(t) && t.length > 0) setTasks(t);
      } catch {}
      setKhoKhanSuCo(found.Kien_Nghi_Vuong_Mac || '');
      setExistingUrls(String(found.Link_Anh_Hien_Truong || '').trim().split('\n').filter(Boolean));
      setNewImages([]);
    } else {
      setWeather({ sang: 'Nắng', chieu: 'Râm mát', toi: 'Râm mát', thoi_gian_mua: '' });
      setPersonnel({ cht: 1, cbkt: 2, cbatld: 1, doi_truong: 1, cong_nhan: 12 });
      setEquipments([{ ten: '', sl: 1 }]);
      setTasks([{ hang_muc: '', kl: '' }]);
      setKhoKhanSuCo('');
      setExistingUrls([]);
      setNewImages([]);
    }
  }, [project, date, nhatKyList]);

  const handleCapture = async (e) => {
    const files = Array.from(e.target.files);
    const stamp = `${project} | ${new Date().toLocaleString('vi-VN')}`;
    const compressed = await Promise.all(files.map((f) => compressAndWatermarkImage(f, stamp)));
    setNewImages((prev) => [...prev, ...compressed]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validTasks = tasks.filter((t) => t.hang_muc.trim() !== '');
    if (validTasks.length === 0) return alert('Vui lòng nhập ít nhất 1 nội dung công việc ở Mục 4!');
    const ok = await onSubmit('CREATE_DAILY_LOG', {
      Ma_Du_An: project, Ngay_Thi_Cong: date, Thoi_Tiet: weather,
      Nhan_Luc_May_Moc: { ...personnel, thiet_bi: equipments.filter((eq) => eq.ten.trim() !== '') },
      Cong_Viec_Thuc_Hien: validTasks, Kien_Nghi_Vuong_Mac: khoKhanSuCo,
      imagesBase64: newImages, Nguoi_Tao: `${user.Ma_NV} - ${user.Ho_Ten}`
    });
    if (ok) setNewImages([]);
  };

  const isUpdating = existingUrls.length > 0 || (nhatKyList || []).some((n) => n.Ma_Du_An === project && String(n.Ngay_Thi_Cong).startsWith(date));

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h2 className="font-bold text-blue-950 text-base">Nhật ký thi công</h2>
        {isUpdating && <span className="text-[11px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Đang bổ sung ngày {date}</span>}
      </div>

      <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 1. Thông tin chung</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Ngày thi công</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1 bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Tên công trình</label>
            <input type="text" readOnly value={projectObj?.Ten_Du_An || project} className="w-full border rounded-lg p-2 text-sm mt-1 bg-slate-100 font-semibold text-slate-700" />
          </div>
        </div>
      </div>

      <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 2. Điều kiện thi công (Thời tiết)</div>
        <div className="grid grid-cols-3 gap-2">
          {[{ key: 'sang', label: 'Buổi sáng' }, { key: 'chieu', label: 'Buổi chiều' }, { key: 'toi', label: 'Buổi tối' }].map((b) => (
            <div key={b.key}>
              <label className="text-xs font-semibold text-slate-600">{b.label}</label>
              <select value={weather[b.key]} onChange={(e) => setWeather({ ...weather, [b.key]: e.target.value })} className="w-full border rounded-lg p-2 text-xs font-semibold mt-1 bg-white">
                {['Nắng', 'Mưa', 'Râm mát'].map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>
          ))}
        </div>
        {(weather.sang === 'Mưa' || weather.chieu === 'Mưa' || weather.toi === 'Mưa' || weather.thoi_gian_mua) && (
          <div>
            <label className="text-xs font-semibold text-slate-600">Thời gian mưa (nếu có)</label>
            <input type="text" placeholder="VD: Mưa rào từ 14h15 đến 15h30..." value={weather.thoi_gian_mua} onChange={(e) => setWeather({ ...weather, thoi_gian_mua: e.target.value })} className="w-full border rounded-lg p-2 text-xs mt-1 bg-white" />
          </div>
        )}
      </div>

      <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 3. Nhân sự và Thiết bị</div>
        <div className="grid grid-cols-3 gap-2">
          {[{ key: 'cht', label: 'CHT' }, { key: 'cbkt', label: 'CBKT' }, { key: 'cbatld', label: 'CB ATLĐ' }, { key: 'doi_truong', label: 'Đội trưởng' }, { key: 'cong_nhan', label: 'Công nhân' }].map((r) => (
            <div key={r.key} className="bg-white border rounded-lg p-1.5">
              <span className="text-[11px] text-slate-500 block">{r.label}</span>
              <input type="number" min="0" value={personnel[r.key]} onChange={(e) => setPersonnel({ ...personnel, [r.key]: Number(e.target.value) })} className="w-full font-bold text-sm text-slate-800 outline-none mt-0.5" />
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-600">Thiết bị thi công</label>
            <button type="button" onClick={() => setEquipments([...equipments, { ten: '', sl: 1 }])} className="text-xs bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded flex items-center gap-0.5"><Plus size={13} /> Thêm máy</button>
          </div>
          {equipments.map((eq, i) => (
            <div key={i} className="flex gap-1.5 mb-1.5">
              <input type="text" placeholder="Tên thiết bị..." value={eq.ten} onChange={(e) => { const c = [...equipments]; c[i].ten = e.target.value; setEquipments(c); }} className="flex-1 border rounded-lg p-2 text-xs bg-white" />
              <input type="number" min="1" value={eq.sl} onChange={(e) => { const c = [...equipments]; c[i].sl = Number(e.target.value); setEquipments(c); }} className="w-16 border rounded-lg p-2 text-xs text-center bg-white" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-xs text-blue-900 uppercase">Mục 4. Nội dung công việc & Vấn đề phát sinh</div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-600">Công việc thi công hàng ngày</label>
            <button type="button" onClick={() => setTasks([...tasks, { hang_muc: '', kl: '' }])} className="text-xs bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded flex items-center gap-0.5"><Plus size={13} /> Thêm việc</button>
          </div>
          {tasks.map((t, i) => (
            <div key={i} className="flex gap-1.5 mb-1.5">
              <input type="text" placeholder="Nội dung công việc..." value={t.hang_muc} onChange={(e) => { const c = [...tasks]; c[i].hang_muc = e.target.value; setTasks(c); }} className="flex-1 border rounded-lg p-2 text-xs bg-white" />
              <input type="text" placeholder="Khối lượng" value={t.kl} onChange={(e) => { const c = [...tasks]; c[i].kl = e.target.value; setTasks(c); }} className="w-24 border rounded-lg p-2 text-xs bg-white" />
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Khó khăn, đề xuất, sự cố (nếu có)</label>
          <textarea rows="3" placeholder="Ghi nhận khó khăn, đề xuất TVGS hoặc sự cố phát sinh..." value={khoKhanSuCo} onChange={(e) => setKhoKhanSuCo(e.target.value)} className="w-full border rounded-lg p-2 text-xs mt-1 bg-white" />
        </div>
      </div>

      <div className="space-y-2">
        <input type="file" accept="image/*" capture="environment" multiple ref={fileRef} onChange={handleCapture} className="hidden" />
        <button type="button" onClick={() => fileRef.current.click()} className="w-full border-2 border-dashed border-blue-300 bg-blue-50/60 text-blue-900 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs">
          <Camera size={18} /> Chụp / Tải thêm ảnh hiện trường ({newImages.length} ảnh mới)
        </button>
        {existingUrls.length > 0 && <div className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">✓ Đã có {existingUrls.length} ảnh lưu trên Drive trong ngày hôm nay.</div>}
        {newImages.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {newImages.map((src, idx) => (
              <div key={idx} className="relative shrink-0">
                <img src={src} alt="preview" className="w-20 h-20 object-cover rounded-lg border" />
                <button type="button" onClick={() => setNewImages(newImages.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow">
        <Send size={18} /> {isUpdating ? 'Cập nhật bổ sung Nhật ký' : 'Gửi Nhật ký lên hệ thống'}
      </button>
    </form>
  );
}

// ============================================================================
// FORM PHIẾU ĐỀ XUẤT VẬT TƯ CHUẨN SEPITECH
// ============================================================================
function MaterialRequestForm({ project, user, vatTuList, editingTx, onCancelEdit, onSubmit }){

  const [loai, setLoai] = useState('YEU_CAU_VAT_TU');
  const [phongBan, setPhongBan] = useState('Ban Điều Hành Dự Án');
  const [sdt, setSdt] = useState('');
  const [mucDich, setMucDich] = useState(`Thi công ${project}`);
  const [thoiGianCan, setThoiGianCan] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ ten: '', quy_cach: '', dvt: 'cái', sl: '', ghi_chu: '' }]);
  const [image, setImage] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [newTenVT, setNewTenVT] = useState('');
  const [newDVT, setNewDVT] = useState('kg');
}
useEffect(() => {
    if (editingTx) {
      setLoai(editingTx.Loai_Giao_Dich || 'YEU_CAU_VAT_TU');
      let meta = {};
      try {
        const raw = String(editingTx._rawMetaJson || editingTx.Ghi_Chu_Anh || '').trim();
        if (raw.startsWith('{')) meta = JSON.parse(raw);
      } catch {}

      setPhongBan(meta.phong_ban || 'Ban Điều Hành Dự Án');
      setSdt(meta.sdt || '');
      setMucDich(meta.muc_dich || '');
      if (meta.thoi_gian_can && meta.thoi_gian_can.includes('/')) {
        setThoiGianCan(meta.thoi_gian_can.split('/').reverse().join('-'));
      }
      if (Array.isArray(meta.items) && meta.items.length > 0) {
        setItems(meta.items);
      } else if (Array.isArray(editingTx._groupedItems) && editingTx._groupedItems.length > 0) {
        setItems(editingTx._groupedItems);
      }
    }
  }, [editingTx]);
  const handleRowChange = (idx, field, val) => {
    const copy = [...items];
    copy[idx][field] = val;
    if (field === 'ten') {
      const matched = vatTuList.find((v) => v.Ten_Vat_Tu === val || `${v.Ma_Vat_Tu} - ${v.Ten_Vat_Tu}` === val);
      if (matched) { copy[idx].ten = matched.Ten_Vat_Tu; copy[idx].dvt = matched.Don_Vi_Tinh; }
    }
    setItems(copy);
  };

  const handleImage = async (e) => {
    if (!e.target.files[0]) return;
    const b64 = await compressAndWatermarkImage(e.target.files[0], `${project} | ${loai} | ${new Date().toLocaleString('vi-VN')}`);
    setImage(b64);
  };

  const handleQuickAddVT = async () => {
    if (!newTenVT.trim()) return;
    await onSubmit('ADD_MASTER_ITEM', { type: 'VAT_TU', Ma_Vat_Tu: toCodeNoDiacritics(newTenVT), Ten_Vat_Tu: newTenVT.trim(), Don_Vi_Tinh: newDVT });
    setNewTenVT('');
    setShowAddNew(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.ten.trim() !== '' && Number(it.sl) > 0);
    if (validItems.length === 0) return alert('Vui lòng nhập ít nhất 1 dòng vật tư có tên và số lượng hợp lệ!');
    const formattedDateCan = thoiGianCan.includes('-') ? thoiGianCan.split('-').reverse().join('/') : thoiGianCan;
    const actionName = editingTx ? 'EDIT_TRANSACTION' : 'CREATE_TRANSACTION';
    const ok = await onSubmit(actionName, {
      Ma_Phieu: editingTx?.Ma_Phieu,
      Nguoi_Yeu_Cau: user.Ho_Ten,
      Loai_Giao_Dich: loai,
      Tu_Kho: loai === 'NHAP_KHO' ? 'NHA_CUNG_CAP' : 'KHO_TONG',
      Den_Kho: project,
      Phong_Ban: phongBan,
      So_Dien_Thoai: sdt,
      Muc_Dich_Su_Dung: mucDich,
      Thoi_Gian_Can: formattedDateCan,
      items: validItems,
      Ma_Doi_Tuong: validItems[0].ten,
      So_Luong: validItems[0].sl,
      Ghi_Chu: mucDich,
      imageBase64: image,
      Nguoi_Tao: editingTx ? editingTx.Nguoi_Tao : user.Ho_Ten,
      Vai_Tro: user.Vai_Tro
    });

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b pb-2">
        <h2 className="font-bold text-blue-950 text-base">Phiếu Đề Xuất Vật Tư</h2>
        <button type="button" onClick={() => setShowAddNew(!showAddNew)} className="text-xs text-blue-800 font-bold flex items-center gap-0.5"><Plus size={14} /> Thêm DM vật tư</button>
      </div>

      {showAddNew && (
        <div className="bg-blue-50 p-2.5 rounded-xl space-y-2 border border-blue-200">
          <input type="text" placeholder="Tên vật tư mới..." value={newTenVT} onChange={(e) => setNewTenVT(e.target.value)} className="w-full border rounded p-1.5 text-xs bg-white" />
          <div className="flex gap-2">
            <input type="text" placeholder="ĐVT" value={newDVT} onChange={(e) => setNewDVT(e.target.value)} className="w-28 border rounded p-1.5 text-xs bg-white" />
            <button type="button" onClick={handleQuickAddVT} className="flex-1 bg-blue-900 text-white text-xs font-bold rounded py-1.5">Lưu danh mục</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setLoai('YEU_CAU_VAT_TU')} className={`py-2 rounded-lg text-xs font-bold border ${loai === 'YEU_CAU_VAT_TU' ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-700'}`}>Phiếu đề xuất cấp VT</button>
        <button type="button" onClick={() => setLoai('NHAP_KHO')} className={`py-2 rounded-lg text-xs font-bold border ${loai === 'NHAP_KHO' ? 'bg-emerald-700 text-white' : 'bg-slate-50 text-slate-700'}`}>Xác nhận nhập kho</button>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div>
          <label className="text-[11px] font-semibold text-slate-600">Phòng ban / Bộ phận</label>
          <input type="text" value={phongBan} onChange={(e) => setPhongBan(e.target.value)} className="w-full border rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600">Số điện thoại</label>
          <input type="tel" placeholder="090..." value={sdt} onChange={(e) => setSdt(e.target.value)} className="w-full border rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600">Mục đích sử dụng</label>
          <input type="text" value={mucDich} onChange={(e) => setMucDich(e.target.value)} className="w-full border rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-600">Thời gian cần</label>
          <input type="date" value={thoiGianCan} onChange={(e) => setThoiGianCan(e.target.value)} className="w-full border rounded-lg p-1.5 text-xs mt-0.5 bg-white" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-700">Danh sách vật tư ({items.length} mục)</label>
          <button type="button" onClick={() => setItems([...items, { ten: '', quy_cach: '', dvt: 'cái', sl: '', ghi_chu: '' }])} className="text-xs bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><Plus size={14} /> Thêm dòng</button>
        </div>
        <datalist id="vat-tu-suggestions">{vatTuList.map((v) => (<option key={v.Ma_Vat_Tu} value={v.Ten_Vat_Tu} />))}</datalist>
        {items.map((it, idx) => (
          <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-blue-900">Mục #{idx + 1}</span>
              {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 text-xs flex items-center gap-0.5"><Trash2 size={13} /> Xóa</button>}
            </div>
            <input type="text" list="vat-tu-suggestions" placeholder="Tên vật tư..." value={it.ten} onChange={(e) => handleRowChange(idx, 'ten', e.target.value)} className="w-full border rounded-lg p-2 text-xs bg-white font-medium" />
            <div className="grid grid-cols-3 gap-1.5">
              <input type="text" placeholder="Quy cách" value={it.quy_cach} onChange={(e) => handleRowChange(idx, 'quy_cach', e.target.value)} className="border rounded-lg p-1.5 text-xs bg-white" />
              <input type="text" placeholder="ĐVT" value={it.dvt} onChange={(e) => handleRowChange(idx, 'dvt', e.target.value)} className="border rounded-lg p-1.5 text-xs bg-white text-center" />
              <input type="number" step="any" placeholder="Số lượng" value={it.sl} onChange={(e) => handleRowChange(idx, 'sl', e.target.value)} className="border rounded-lg p-1.5 text-xs bg-white font-bold text-center" />
            </div>
            <input type="text" placeholder="Ghi chú..." value={it.ghi_chu} onChange={(e) => handleRowChange(idx, 'ghi_chu', e.target.value)} className="w-full border rounded-lg p-1.5 text-xs bg-white" />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Ảnh đính kèm (nếu có)</label>
        <input type="file" accept="image/*" capture="environment" onChange={handleImage} className="text-xs" />
      </div>

      <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow"><Send size={18} /> Gửi Phiếu Đề Xuất</button>
    </form>
  );
}

// ============================================================================
// FORM ĐIỀU CHUYỂN THIẾT BỊ
// ============================================================================
function EquipmentTransferForm({ project, user, duAnList, thietBiList, onSubmit }) {
  const [maThietBi, setMaThietBi] = useState(thietBiList[0]?.Ma_Thiet_Bi || '');
  const [denKho, setDenKho] = useState('SBLT');
  const [ghiChu, setGhiChu] = useState('');
  const selectedEq = thietBiList.find((t) => t.Ma_Thiet_Bi === maThietBi);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tuKho = selectedEq?.Vi_Tri_Hien_Tai || project;
    if (tuKho === denKho) return alert('Nơi nhận phải khác vị trí hiện tại của thiết bị!');
    const ok = await onSubmit('CREATE_TRANSACTION', {
      Loai_Giao_Dich: 'DIEU_CHUYEN', Tu_Kho: tuKho, Den_Kho: denKho,
      Ma_Doi_Tuong: maThietBi, So_Luong: 1, Ghi_Chu: ghiChu, Nguoi_Tao: user.Ho_Ten, Vai_Tro: user.Vai_Tro
    });
    if (ok) setGhiChu('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
      <h2 className="font-bold text-blue-950 text-base border-b pb-2">Điều chuyển Máy & Thiết bị</h2>
      <div>
        <label className="text-xs font-semibold text-slate-600">Chọn thiết bị cần điều chuyển</label>
        <select value={maThietBi} onChange={(e) => setMaThietBi(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1 bg-white">
          {thietBiList.map((tb) => (<option key={tb.Ma_Thiet_Bi} value={tb.Ma_Thiet_Bi}>{tb.Ma_Thiet_Bi} - {tb.Ten_Thiet_Bi} [Đang ở: {tb.Vi_Tri_Hien_Tai}]</option>))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border">
        <div>
          <span className="text-[11px] text-slate-500">Từ công trường/kho</span>
          <div className="font-bold text-sm text-slate-800">{selectedEq?.Vi_Tri_Hien_Tai || project}</div>
        </div>
        <div>
          <span className="text-[11px] text-slate-500">Chuyển đến</span>
          <select value={denKho} onChange={(e) => setDenKho(e.target.value)} className="w-full border rounded p-1 text-sm font-bold text-blue-900 bg-white mt-0.5">
            {duAnList.map((d) => (<option key={d.Ma_Du_An} value={d.Ma_Du_An}>{d.Ma_Du_An}</option>))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Lý do điều chuyển</label>
        <input type="text" placeholder="VD: Phục vụ căng kéo nhịp 2..." value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} className="w-full border rounded-lg p-2.5 text-sm mt-1" />
      </div>
      <button type="submit" className="w-full bg-blue-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow"><Truck size={18} /> Lập lệnh điều chuyển</button>
    </form>
  );
}

// ============================================================================
// LỊCH SỬ HỒ SƠ, XÓA PHIẾU & IN PDF KHỔ A4
// ============================================================================
function DocumentArchive({ project, user, nhatKyList, giaoDichList, Pencil, onPrint, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const keyword = searchTerm.trim().toLowerCase();

  const projectLogs = nhatKyList
    .filter((n) => n.Ma_Du_An === project)
    .filter((n) => !keyword || String(n.Ma_Nhat_Ky || '').toLowerCase().includes(keyword) || String(n.Ngay_Thi_Cong || '').toLowerCase().includes(keyword));

  // Gom tất cả các dòng vật tư có cùng Ma_Phieu thành 1 phiếu hoàn chỉnh
  const uniqueTxMap = new Map();
  giaoDichList
    .filter((g) => g.Den_Kho === project || g.Tu_Kho === project)
    .forEach((g) => {
      const noteStr = String(g.Ghi_Chu_Anh || '').trim();
      const isJsonMeta = noteStr.startsWith('{');

      if (!uniqueTxMap.has(g.Ma_Phieu)) {
        uniqueTxMap.set(g.Ma_Phieu, {
          ...g,
          _rawMetaJson: isJsonMeta ? noteStr : '',
          _groupedItems: [{
            ten: g.Ma_Doi_Tuong,
            quy_cach: '',
            dvt: '',
            sl: g.So_Luong,
            ghi_chu: !isJsonMeta ? noteStr : ''
          }]
        });
      } else {
        const existing = uniqueTxMap.get(g.Ma_Phieu);
        if (isJsonMeta && !existing._rawMetaJson) {
          existing._rawMetaJson = noteStr;
        }
        existing._groupedItems.push({
          ten: g.Ma_Doi_Tuong,
          quy_cach: '',
          dvt: '',
          sl: g.So_Luong,
          ghi_chu: !isJsonMeta ? noteStr : ''
        });
      }
    });

  const projectTx = Array.from(uniqueTxMap.values()).filter((g) =>
    !keyword ||
    String(g.Ma_Phieu || '').toLowerCase().includes(keyword) ||
    g._groupedItems.some((it) => String(it.ten || '').toLowerCase().includes(keyword)) ||
    String(g.Ngay_Chung_Tu || '').toLowerCase().includes(keyword)
  );

  const handleDeleteClick = (tx) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa phiếu ${tx.Ma_Phieu} không?`)) {
      onDelete('DELETE_TRANSACTION', {
        Ma_Phieu: tx.Ma_Phieu,
        Nguoi_Yeu_Cau: user.Ho_Ten,
        Vai_Tro: user.Vai_Tro
      });
    }
  };

  const formatShortDate = (raw) => {
    const s = String(raw || '');
    if (s.includes('T')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    return s.slice(0, 10);
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Tìm nhanh theo ngày hoặc mã phiếu, tên vật tư..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-sm outline-none focus:border-blue-800"
      />

      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="font-bold text-blue-950 text-sm">Nhật ký thi công gần đây</h2>
          <span className="text-[11px] text-slate-400">{projectLogs.length} bản ghi</span>
        </div>
        {projectLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">Không có nhật ký phù hợp.</p>
        ) : (
          projectLogs.map((log) => (
            <div key={log.Ma_Nhat_Ky} className="flex justify-between items-center border-b py-2.5 last:border-0 gap-2">
              <div className="min-w-0">
                <div className="font-bold text-xs text-slate-800 truncate">{log.Ma_Nhat_Ky}</div>
                <div className="text-[11px] text-slate-500">Ngày: {formatShortDate(log.Ngay_Thi_Cong)}</div>
              </div>
              <button onClick={() => onPrint('NHAT_KY', log)} className="shrink-0 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                <Printer size={14} /> Xuất A4
              </button>
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="font-bold text-blue-950 text-sm">Phiếu Đề Xuất & Điều Chuyển</h2>
          <span className="text-[11px] text-slate-400">{projectTx.length} phiếu</span>
        </div>
        {projectTx.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">Không có phiếu phù hợp.</p>
        ) : (
          projectTx.map((tx) => {
            const canDelete = user.Vai_Tro === 'GIAM_DOC' || String(tx.Nguoi_Tao || '').includes(user.Ho_Ten);
            const itemSummary = tx._groupedItems.map((it) => `${it.ten} (${it.sl})`).join(', ');

            return (
              <div key={tx.Ma_Phieu} className="flex justify-between items-center border-b py-2.5 last:border-0 gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-800">{tx.Ma_Phieu}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tx.Trang_Thai_Duyet === 'Da_Duyet' ? 'bg-emerald-100 text-emerald-800' : tx.Trang_Thai_Duyet === 'Tu_Choi' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                      {tx.Trang_Thai_Duyet}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate mt-0.5">{itemSummary}</div>
                  <div className="text-[10px] text-slate-400">Ngày: {formatShortDate(tx.Ngay_Chung_Tu)} • {tx.Nguoi_Tao}</div>
                </div>

              <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => onPrint('PHIEU', tx)} className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                    <Printer size={14} /> A4
                  </button>
                  {canDelete && tx.Loai_Giao_Dich !== 'DIEU_CHUYEN' && (
                    <button onClick={() => onEdit(tx)} title="Sửa phiếu này" className="bg-amber-50 text-amber-700 border border-amber-200 p-1.5 rounded-lg hover:bg-amber-100">
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDeleteClick(tx)} title="Xóa phiếu này" className="bg-red-50 text-red-600 border border-red-200 p-1.5 rounded-lg hover:bg-red-100">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DUYỆT PHIẾU (BAN GIÁM ĐỐC & THỦ KHO)
// ============================================================================
function ApprovalList({ transactions, user, onApprove }) {
  const uniquePendingMap = new Map();
  transactions.filter((t) => t.Trang_Thai_Duyet === 'Cho_Duyet').forEach((t) => {
    if (!uniquePendingMap.has(t.Ma_Phieu)) uniquePendingMap.set(t.Ma_Phieu, t);
  });
  const pending = Array.from(uniquePendingMap.values());

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-blue-950 text-base">Phiếu chờ phê duyệt ({pending.length})</h2>
      {pending.length === 0 ? <div className="bg-white rounded-2xl p-6 text-center text-slate-500 text-sm">Tất cả phiếu đề xuất đều đã được xử lý!</div> : pending.map((item) => {
        let metaItems = [];
        try {
          if (typeof item.Ghi_Chu_Anh === 'string' && item.Ghi_Chu_Anh.trim().startsWith('{')) {
            const parsed = JSON.parse(item.Ghi_Chu_Anh);
            if (Array.isArray(parsed.items)) metaItems = parsed.items;
          }
        } catch {}

        return (
          <div key={item.Ma_Phieu} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-amber-500 space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-bold text-sm text-blue-950">{item.Ma_Phieu}</span>
              <span className="text-[11px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded">{item.Loai_Giao_Dich}</span>
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <div><strong>Công trình:</strong> {item.Den_Kho} (Từ: {item.Tu_Kho || 'N/A'})</div>
              <div><strong>Người lập:</strong> {item.Nguoi_Tao} ({item.Ngay_Chung_Tu})</div>
              {metaItems.length > 0 ? (
                <div className="bg-slate-50 p-2 rounded-lg border mt-1 space-y-1">
                  {metaItems.map((m, idx) => (<div key={idx}>• {m.ten} ({m.quy_cach || '-'}): <strong>{m.sl} {m.dvt}</strong></div>))}
                </div>
              ) : (
                <div><strong>Đối tượng:</strong> {item.Ma_Doi_Tuong} — SL: <strong className="text-blue-900">{item.So_Luong}</strong></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => onApprove('APPROVE_TRANSACTION', { Ma_Phieu: item.Ma_Phieu, Trang_Thai_Moi: 'Da_Duyet', Nguoi_Duyet: `${user.Ma_NV} - ${user.Ho_Ten}` })} className="bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1"><CheckCircle2 size={16} /> Phê duyệt</button>
              <button onClick={() => onApprove('APPROVE_TRANSACTION', { Ma_Phieu: item.Ma_Phieu, Trang_Thai_Moi: 'Tu_Choi', Nguoi_Duyet: `${user.Ma_NV} - ${user.Ho_Ten}` })} className="bg-red-100 text-red-700 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1"><XCircle size={16} /> Từ chối</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}