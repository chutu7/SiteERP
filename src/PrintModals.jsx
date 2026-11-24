import React, { useState } from 'react';
import { Printer, X, KeyRound } from 'lucide-react';

export const SEPITECH_LOGO_URL = 'https://sepitech.com/wp-content/uploads/2024/01/logo_sepitech_200x200.png';

// ============================================================================
// BẢN IN HÀNH CHÍNH KHỔ A4 (NHẬT KÝ & PHIẾU ĐỀ XUẤT SEPITECH)
// ============================================================================
export function PrintA4Modal({ doc, projectInfo, onClose }) {
  const { type, item } = doc;
  let tasks = [];
  let resources = {};
  let weatherObj = { sang: '', chieu: '', toi: '', thoi_gian_mua: '' };

  if (type === 'NHAT_KY') {
    try {
      tasks = typeof item.Cong_Viec_Thuc_Hien === 'string'
        ? JSON.parse(item.Cong_Viec_Thuc_Hien)
        : (item.Cong_Viec_Thuc_Hien || []);
    } catch {}
    try {
      resources = typeof item.Nhan_Luc_May_Moc === 'string'
        ? JSON.parse(item.Nhan_Luc_May_Moc)
        : (item.Nhan_Luc_May_Moc || {});
    } catch {}
    try {
      weatherObj = typeof item.Thoi_Tiet === 'string' && item.Thoi_Tiet.startsWith('{')
        ? JSON.parse(item.Thoi_Tiet)
        : { sang: item.Thoi_Tiet || '', chieu: '', toi: '', thoi_gian_mua: '' };
    } catch {}
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 overflow-y-auto p-2 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-slate-800 text-white p-3 rounded-t-xl flex justify-between items-center no-print">
        <span className="text-xs font-bold">Xem trước bản in khổ A4 (Bấm In rồi Lưu thành PDF để gửi Zalo)</span>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
            <Printer size={15} /> In / Lưu PDF
          </button>
          <button onClick={onClose} className="bg-slate-600 px-2.5 py-1.5 rounded-lg text-xs">
            <X size={15} />
          </button>
        </div>
      </div>

      <div id="print-area" className="bg-white w-full max-w-2xl p-6 text-black text-sm leading-relaxed shadow-2xl">
        {type === 'NHAT_KY' ? (
          <>
            <div className="flex justify-between text-center border-b border-black pb-3 mb-4">
              <div className="w-5/12">
                <div className="font-bold uppercase text-xs">CÔNG TY CỔ PHẦN SEPITECH</div>
                <div className="text-xs mt-0.5">Ban Điều Hành Dự Án {projectInfo.Ma_Du_An}</div>
              </div>
              <div className="w-7/12">
                <div className="font-bold uppercase text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="font-bold text-xs underline">Độc lập - Tự do - Hạnh phúc</div>
              </div>
            </div>

            <h1 className="text-center font-bold text-base uppercase mt-2">NHẬT KÝ THI CÔNG XÂY DỰNG CÔNG TRÌNH</h1>
            <p className="text-center italic text-xs mb-4">(Theo Nghị định số 06/2021/NĐ-CP của Chính phủ)</p>

            <div className="space-y-1 text-xs mb-3">
              <div><strong>Mục 1. Tên công trình:</strong> {projectInfo.Ten_Du_An} ({projectInfo.Ma_Du_An})</div>
              <div className="pl-3"><strong>Ngày thi công:</strong> {item.Ngay_Thi_Cong} — <strong>Mã nhật ký:</strong> {item.Ma_Nhat_Ky}</div>
            </div>

            <div className="space-y-1 text-xs mb-3">
              <div>
                <strong>Mục 2. Điều kiện thi công (Thời tiết):</strong> Sáng: {weatherObj.sang || '---'}; Chiều: {weatherObj.chieu || '---'}; Tối: {weatherObj.toi || '---'}.
              </div>
              {weatherObj.thoi_gian_mua && (
                <div className="pl-3"><strong>Thời gian mưa:</strong> {weatherObj.thoi_gian_mua}</div>
              )}
            </div>

            <div className="space-y-1.5 text-xs mb-3">
              <div><strong>Mục 3. Nhân sự và Thiết bị thi công:</strong></div>
              <div className="pl-3">
                - <em>Nhân sự:</em> CHT: {resources.cht ?? 0}; CBKT: {resources.cbkt ?? (resources.ky_su || 0)}; CB ATLĐ: {resources.cbatld ?? 0}; Đội trưởng: {resources.doi_truong ?? 0}; Công nhân: {resources.cong_nhan ?? 0} người.
              </div>
              <div className="pl-3">
                - <em>Thiết bị thi công:</em>{' '}
                {Array.isArray(resources.thiet_bi) && resources.thiet_bi.length > 0
                  ? resources.thiet_bi.map((eq) => `${eq.ten} (${eq.sl})`).join(', ')
                  : (resources.may || 'Theo dây chuyền thi công')}
              </div>
            </div>

            <div className="font-bold text-xs mb-1">Mục 4. Nội dung công việc thi công & Vấn đề phát sinh:</div>
            <table className="w-full border-collapse border border-black text-xs mb-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-1.5 w-10">STT</th>
                  <th className="border border-black p-1.5 text-left">Nội dung công việc thi công hàng ngày</th>
                  <th className="border border-black p-1.5 w-28">Khối lượng</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, idx) => (
                  <tr key={idx}>
                    <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-1.5">{t.hang_muc}</td>
                    <td className="border border-black p-1.5 text-center">{t.kl}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs mb-6">
              <strong>Khó khăn, đề xuất, sự cố trong ngày:</strong>
              <p className="mt-1 border border-black p-2 min-h-[48px]">{item.Kien_Nghi_Vuong_Mac || 'Thi công bình thường, đảm bảo an toàn và tiến độ.'}</p>
            </div>

            <div className="grid grid-cols-2 text-center text-xs mt-8">
              <div>
                <div className="font-bold uppercase">ĐẠI DIỆN NHÀ THẦU THI CÔNG</div>
                <div className="italic text-[11px]">(Ký, ghi rõ họ tên)</div>
                <div className="h-20"></div>
              </div>
              <div>
                <div className="font-bold uppercase">TƯ VẤN GIÁM SÁT HIỆN TRƯỜNG</div>
                <div className="italic text-[11px]">(Ký, ghi rõ họ tên)</div>
                <div className="h-20"></div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-black" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            {(() => {
             let meta = {
                phong_ban: 'Ban Điều Hành Dự Án',
                sdt: '',
                muc_dich: '',
                thoi_gian_can: '',
                items: []
              };
              try {
                if (typeof item.Ghi_Chu_Anh === 'string' && item.Ghi_Chu_Anh.trim().startsWith('{')) {
                  meta = { ...meta, ...JSON.parse(item.Ghi_Chu_Anh) };
                }
              } catch {}

              // Nếu có mảng nhiều dòng đã gom từ App.jsx thì ưu tiên dùng để không sót vật tư
              if (Array.isArray(item._groupedItems) && item._groupedItems.length > 0 && meta.items.length < item._groupedItems.length) {
                meta.items = item._groupedItems;
              } else if (meta.items.length === 0) {
                meta.items = [{
                  ten: item.Ma_Doi_Tuong,
                  quy_cach: '',
                  dvt: '',
                  sl: item.So_Luong,
                  ghi_chu: typeof item.Ghi_Chu_Anh === 'string' && !item.Ghi_Chu_Anh.startsWith('{') ? item.Ghi_Chu_Anh : ''
                }];
              }

              // Chuẩn hóa ngày tháng theo giờ Việt Nam (tránh lỗi 23T17:00:00.000Z)
              let dayStr = '...';
              let monthStr = '...';
              let yearStr = '2026';
              const rawDate = String(item.Ngay_Chung_Tu || '');
              if (rawDate.includes('T')) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                  dayStr = String(d.getDate()).padStart(2, '0');
                  monthStr = String(d.getMonth() + 1).padStart(2, '0');
                  yearStr = String(d.getFullYear());
                }
              } else if (rawDate.includes('-')) {
                const parts = rawDate.split('-');
                yearStr = parts[0] || '2026';
                monthStr = parts[1] || '...';
                dayStr = (parts[2] || '...').slice(0, 2);
              }

              return (
                <>
                  <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-4">
                    <div>
                      <div className="font-bold text-sm uppercase">CÔNG TY CỔ PHẦN SEPITECH</div>
                      <div className="text-xs mt-0.5">354 Lũy Bán Bích, Phường Tân Phú, TP.HCM</div>
                    </div>
                    <img src={SEPITECH_LOGO_URL} alt="SEPITECH" className="h-14 w-auto object-contain" />
                  </div>

                  <div className="text-center my-4">
                    <h1 className="font-bold text-lg uppercase">
                      {item.Loai_Giao_Dich === 'DIEU_CHUYEN' ? 'LỆNH ĐIỀU CHUYỂN THIẾT BỊ' : 'PHIẾU ĐỀ XUẤT'}
                    </h1>
                    <div className="text-xs italic mt-0.5">Số phiếu: <strong>{item.Ma_Phieu}</strong></div>
                  </div>

                  <div className="space-y-1 text-xs mb-3">
                    <div><strong>Kính gửi:</strong> Ban giám đốc Công ty</div>
                    <div><strong>Công trình:</strong> <span className="uppercase font-bold">{projectInfo.Ten_Du_An}</span></div>
                    <div><strong>Người yêu cầu:</strong> <span className="uppercase font-bold">{item.Nguoi_Tao}</span></div>
                    <div><strong>Phòng Ban đề nghị:</strong> {meta.phong_ban}</div>
                    <div className="pt-1">Đề nghị Công ty xem xét cung cấp các loại vật tư thiết bị như sau:</div>
                  </div>

                  <table className="w-full border-collapse border border-black text-xs mb-3">
                    <thead>
                      <tr className="bg-gray-100 font-bold text-center">
                        <th className="border border-black p-1.5 w-10">STT</th>
                        <th className="border border-black p-1.5 text-left">Nội dung</th>
                        <th className="border border-black p-1.5 w-28">Quy cách</th>
                        <th className="border border-black p-1.5 w-14">ĐVT</th>
                        <th className="border border-black p-1.5 w-16">Số lượng</th>
                        <th className="border border-black p-1.5 w-28">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.items.map((row, idx) => (
                        <tr key={idx}>
                          <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                          <td className="border border-black p-1.5">{row.ten}</td>
                          <td className="border border-black p-1.5 text-center">{row.quy_cach}</td>
                          <td className="border border-black p-1.5 text-center">{row.dvt}</td>
                          <td className="border border-black p-1.5 text-center font-bold">{row.sl}</td>
                          <td className="border border-black p-1.5">{row.ghi_chu}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="space-y-1 text-xs mb-6">
                    <div><strong>Số điện thoại:</strong> {meta.sdt}</div>
                    <div><strong>Mục đích sử dụng:</strong> {meta.muc_dich}</div>
                    <div><strong>Thời gian cần thực hiện:</strong> {meta.thoi_gian_can}</div>
                    <div className="pt-1 italic">Kính mong Ban giám đốc xem xét và phê duyệt!</div>
                  </div>

                  <div className="text-right text-xs italic mb-2 pr-4">
                    TP HCM, ngày {dayStr} tháng {monthStr} năm {yearStr}
                  </div>
                  <div className="grid grid-cols-3 text-center text-xs">
                    <div>
                      <div className="font-bold uppercase">NGƯỜI ĐỀ NGHỊ</div>
                      <div className="italic text-[11px]">(ký và ghi rõ họ tên)</div>
                      <div className="h-20"></div>
                      <div className="font-bold uppercase">{item.Nguoi_Tao}</div>
                    </div>
                    <div>
                      <div className="font-bold uppercase">TRƯỞNG BỘ PHẬN</div>
                      <div className="italic text-[11px]">(ký và ghi rõ họ tên)</div>
                      <div className="h-20"></div>
                    </div>
                    <div>
                      <div className="font-bold uppercase">GIÁM ĐỐC</div>
                      <div className="italic text-[11px]">(ký và ghi rõ họ tên)</div>
                      <div className="h-20"></div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CỬA SỔ ĐỔI MẬT KHẨU / MÃ PIN
// ============================================================================
export function ChangePasswordModal({ user, isOnline, apiUrl, onClose, onSuccess, onError }) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) return onError('Cần có mạng Internet để đổi mật khẩu!');
    if (!oldPin || !newPin) return onError('Vui lòng nhập đầy đủ mật khẩu cũ và mới!');
    if (newPin !== confirmPin) return onError('Mật khẩu mới nhập lại không khớp!');
    if (newPin.trim().length < 4) return onError('Mật khẩu mới nên có ít nhất 4 ký tự!');

    setLoading(true);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'CHANGE_PASSWORD',
          payload: {
            Ma_NV: user.Ma_NV,
            oldPin: oldPin.trim(),
            newPin: newPin.trim()
          }
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        onSuccess(newPin.trim());
      } else {
        onError(json.message || 'Đổi mật khẩu thất bại!');
      }
    } catch (err) {
      onError('Lỗi kết nối máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 no-print">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-blue-950 text-base flex items-center gap-1.5">
            <KeyRound size={18} /> Đổi mật khẩu ({user.Ma_NV})
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Mật khẩu hiện tại</label>
            <input type="password" inputMode="numeric" value={oldPin} onChange={(e) => setOldPin(e.target.value)} placeholder="Nhập mật khẩu đang dùng..." className="w-full border rounded-xl p-2.5 text-sm mt-1 outline-none focus:border-blue-800" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Mật khẩu mới</label>
            <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Nhập mật khẩu mới (tối thiểu 4 số)..." className="w-full border rounded-xl p-2.5 text-sm mt-1 outline-none focus:border-blue-800" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Xác nhận mật khẩu mới</label>
            <input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Nhập lại mật khẩu mới..." className="w-full border rounded-xl p-2.5 text-sm mt-1 outline-none focus:border-blue-800" />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button type="button" onClick={onClose} className="py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs">Hủy</button>
            <button type="submit" disabled={loading} className="py-2.5 rounded-xl bg-blue-900 text-white font-bold text-xs disabled:opacity-50">
              {loading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}