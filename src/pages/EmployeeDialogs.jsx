import { useEffect, useState } from 'react';
import { ConfirmDialog, Dialog } from '../components/Dialog.jsx';
import { Button } from '../components/Button.jsx';
import { PersonPicker, Select, TextField } from '../components/Form.jsx';
import { Banner } from '../components/Feedback.jsx';
import { useT } from '../state/prefs.jsx';
import { usePeople } from '../state/people.jsx';
import { useSession } from '../auth/session.jsx';
import { can } from '../auth/permissions.js';
import { api } from '../api/endpoints.js';
import { invalidate } from '../hooks/useQuery.js';
import { useErrorToast, useToast } from '../components/Toast.jsx';
import { describeError } from '../lib/errors.js';
import { EMPLOYEE_STATUS_LABEL } from '../components/Badge.jsx';

export function refreshEmployees() {
  invalidate('employees', 'employee:', 'profile:', 'departments', 'dept:', 'graph', 'stats', 'audit', 'teammates', 'connections');
}

const EMPTY = { full_name: '', email: '', title: '', department_id: '', hire_date: '', phone: '', status: 'ACTIVE' };

// Thêm hoặc sửa nhân viên (vai trò hr). Lỗi 409/422 hiện ngay dưới ô liên quan.
export function EmployeeFormDialog({ open, onClose, employeeId, onSaved }) {
  const t = useT();
  const { departments } = usePeople();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState(null);
  const [formError, setFormError] = useState(null);
  const [employee, setEmployee] = useState(null);
  const editing = Boolean(employeeId);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setEmployee(null);
    setForm(EMPTY);
    if (!employeeId) return;
    setState('loading');
    api
      .employee(employeeId)
      .then((e) => {
        setEmployee(e);
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(e).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? ''])), hire_date: String(e.hire_date || '').slice(0, 10) });
      })
      .catch((err) => setFormError(describeError(err, t)))
      .finally(() => setState(null));
  }, [open, employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.full_name.trim()) next.full_name = t('Nhập họ và tên.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t('Email chưa đúng định dạng, ví dụ ten.ho@company.vn.');
    if (form.phone && !/^[0-9+\s().-]{8,20}$/.test(form.phone)) next.phone = t('Số điện thoại gồm 8 đến 20 chữ số.');
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setState('loading');
    setFormError(null);
    const body = {
      full_name: form.full_name.trim(), email: form.email.trim(), title: form.title.trim() || null,
      department_id: form.department_id ? Number(form.department_id) : null, hire_date: form.hire_date || null,
      phone: form.phone.trim() || null, status: form.status,
    };
    try {
      let saved;
      if (editing) {
        if (!employee) throw new Error('not loaded');
        const changes = Object.fromEntries(Object.entries(body).filter(([k, v]) => (employee[k] ?? null) !== v && !(k === 'hire_date' && String(employee.hire_date || '').slice(0, 10) === (v || ''))));
        if (!Object.keys(changes).length) {
          setState(null);
          onClose();
          return;
        }
        saved = await api.updateEmployee(employee.employee_id, changes);
      } else {
        Object.keys(body).forEach((k) => body[k] === null && delete body[k]);
        saved = await api.createEmployee(body);
      }
      setState('success');
      refreshEmployees();
      toast.show({ tone: 'success', title: editing ? t('Đã lưu thay đổi') : t('Đã thêm {name}', { name: body.full_name }) });
      setTimeout(() => {
        setState(null);
        onClose();
        onSaved?.(saved);
      }, 500);
    } catch (err) {
      setState(null);
      const info = describeError(err, t);
      if (err.code === 'DUPLICATE_RECORD') setErrors({ email: t('Email này đã được dùng cho một nhân viên khác.') });
      else setFormError(info);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? t('Sửa thông tin nhân viên') : t('Thêm nhân viên')}
      description={editing ? employee?.full_name || t('Đang tải hồ sơ...') : t('Nhân viên mới sẽ xuất hiện trong danh bạ và đồ thị ngay khi lưu.')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={submit} state={state}>
            {editing ? t('Lưu thay đổi') : t('Thêm nhân viên')}
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        {formError && (
          <Banner tone="danger" title={formError.title} className="span-2">
            {formError.message}
          </Banner>
        )}
        <TextField label={t('Họ và tên')} required value={form.full_name} onChange={set('full_name')} error={errors.full_name} maxLength={150} autoComplete="name" />
        <TextField label={t('Email công ty')} required type="email" value={form.email} onChange={set('email')} error={errors.email} maxLength={150} autoComplete="email" />
        <TextField label={t('Chức danh')} value={form.title} onChange={set('title')} maxLength={100} placeholder={t('Ví dụ: Backend Developer')} />
        <Select
          label={t('Phòng ban')}
          value={form.department_id}
          onChange={set('department_id')}
          options={[{ value: '', label: t('Chưa xếp phòng ban') }, ...departments.map((d) => ({ value: d.department_id, label: d.department_name }))]}
        />
        <TextField label={t('Ngày vào làm')} type="date" value={form.hire_date} onChange={set('hire_date')} />
        <TextField label={t('Số điện thoại')} type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} maxLength={20} autoComplete="tel" />
        <Select
          label={t('Trạng thái')}
          value={form.status}
          onChange={set('status')}
          options={Object.entries(EMPLOYEE_STATUS_LABEL).map(([value, label]) => ({ value, label: t(label) }))}
        />
      </form>
    </Dialog>
  );
}

export function ManagerDialog({ open, onClose, employee }) {
  const t = useT();
  const toast = useToast();
  const showError = useErrorToast();
  const { role } = useSession();
  const [managerId, setManagerId] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (open) {
      setManagerId(employee?.manager_id || null);
      setError(null);
    }
  }, [open, employee]);
  if (!employee) return null;
  const save = async () => {
    setState('loading');
    setError(null);
    try {
      await api.setManager(employee.employee_id, managerId);
      setState(null);
      refreshEmployees();
      toast.show({ tone: 'success', title: t('Đã đổi quản lý trực tiếp') });
      onClose();
    } catch (err) {
      setState(null);
      if (['MANAGEMENT_CYCLE', 'SELF_MANAGER'].includes(err.code)) setError(describeError(err, t).message);
      else showError(err);
    }
  };
  const remove = async () => {
    try {
      await api.removeManager(employee.employee_id);
      refreshEmployees();
      toast.show({ tone: 'success', title: t('Đã gỡ quản lý trực tiếp') });
      onClose();
    } catch (err) {
      showError(err);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Quản lý trực tiếp')}
      description={t('Chọn người mà {name} báo cáo. Linko chặn phân công tạo vòng lặp quản lý.', { name: employee.full_name })}
      footer={
        <>
          {employee.manager_id && can.remove(role) && (
            <Button variant="ghost" className="mr-auto" onClick={remove}>
              {t('Gỡ quản lý')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={save} state={state} disabled={!managerId || managerId === employee.manager_id}>
            {t('Lưu quản lý')}
          </Button>
        </>
      }
    >
      <PersonPicker label={t('Người quản lý')} value={managerId} onChange={setManagerId} excludeIds={[employee.employee_id]} error={error} />
    </Dialog>
  );
}

// Xoá nhân viên (admin): mặc định chuyển sang Đã nghỉ (xoá mềm V7). Xoá cứng: xem tác động, gõ lại email.
export function DeleteEmployeeDialog({ open, onClose, employee, onDeleted }) {
  const t = useT();
  const toast = useToast();
  const showError = useErrorToast();
  const [mode, setMode] = useState('soft');
  const [impact, setImpact] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!open || !employee) return;
    setMode('soft');
    setImpact(null);
    setLoadingImpact(true);
    api.employeeImpact(employee.employee_id).then(setImpact).catch(() => setImpact(null)).finally(() => setLoadingImpact(false));
  }, [open, employee]);
  if (!employee) return null;
  const deps = impact?.dependencies || {};
  const rows = [
    { label: t('Thành viên dự án'), count: deps.memberships ?? 0, icon: 'folder' },
    { label: t('Kết nối'), count: deps.connections ?? 0, icon: 'handshake' },
    { label: t('Quan hệ báo cáo lên'), count: deps.own_manager ?? 0, icon: 'arrow-up' },
    { label: t('Cấp dưới trực tiếp'), count: deps.direct_reports ?? 0, icon: 'sitemap' },
  ];
  const confirm = async () => {
    setState('loading');
    try {
      if (mode === 'soft') {
        await api.softDeleteEmployee(employee.employee_id);
        toast.show({
          tone: 'success',
          title: t('Đã chuyển {name} sang Đã nghỉ', { name: employee.full_name }),
          action: t('Hoàn tác'),
          onAction: () => api.setEmployeeStatus(employee.employee_id, employee.status || 'ACTIVE').then(refreshEmployees).catch(showError),
        });
      } else {
        await api.hardDeleteEmployee(employee.employee_id, impact?.has_dependencies);
        toast.show({ tone: 'success', title: t('Đã xoá vĩnh viễn {name}', { name: employee.full_name }) });
      }
      setState(null);
      refreshEmployees();
      onClose();
      onDeleted?.(mode);
    } catch (err) {
      setState(null);
      showError(err);
    }
  };
  const hasReports = (deps.direct_reports ?? 0) > 0;
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      state={state}
      title={mode === 'soft' ? t('Chuyển {name} sang Đã nghỉ?', { name: employee.full_name }) : t('Xoá vĩnh viễn {name}?', { name: employee.full_name })}
      description={mode === 'soft' ? t('Hồ sơ và các quan hệ được giữ cho báo cáo; người này không còn xuất hiện trong đồ thị đang hoạt động.') : t('Xoá cứng không thể hoàn tác. Các quan hệ dưới đây sẽ bị xoá liên đới; nhật ký KNOWS vẫn được giữ.')}
      impact={rows}
      impactLoading={loadingImpact}
      confirmText={mode === 'hard' ? employee.email : undefined}
      confirmLabel={mode === 'soft' ? t('Chuyển sang Đã nghỉ') : t('Xoá vĩnh viễn')}
      tone={mode === 'soft' ? 'neutral' : 'danger'}
    >
      <div className="delete-mode">
        <label className={`radio-card${mode === 'soft' ? ' is-on' : ''}`}>
          <input type="radio" name="del-mode" checked={mode === 'soft'} onChange={() => setMode('soft')} />
          <span>
            <span className="t-label">{t('Xoá mềm (khuyên dùng)')}</span>
            <span className="muted t-caption">{t('Đổi trạng thái sang Đã nghỉ, khôi phục được.')}</span>
          </span>
        </label>
        <label className={`radio-card${mode === 'hard' ? ' is-on' : ''}${hasReports ? ' is-disabled' : ''}`}>
          <input type="radio" name="del-mode" checked={mode === 'hard'} onChange={() => setMode('hard')} disabled={hasReports} />
          <span>
            <span className="t-label">{t('Xoá cứng')}</span>
            <span className="muted t-caption">{hasReports ? t('Gán quản lý mới cho cấp dưới trước.') : t('Xoá bản ghi khỏi Oracle.')}</span>
          </span>
        </label>
      </div>
    </ConfirmDialog>
  );
}
