import { useEffect, useState } from 'react';
import { ConfirmDialog, Dialog } from '../components/Dialog.jsx';
import { Button } from '../components/Button.jsx';
import { PersonPicker, Select, TextField } from '../components/Form.jsx';
import { StrengthMeter } from '../components/DataBits.jsx';
import { Banner } from '../components/Feedback.jsx';
import { CONNECTION_TYPES } from '../components/Badge.jsx';
import { useT } from '../state/prefs.jsx';
import { api } from '../api/endpoints.js';
import { invalidate } from '../hooks/useQuery.js';
import { useErrorToast, useToast } from '../components/Toast.jsx';
import { describeError } from '../lib/errors.js';

export function refreshConnections() {
  invalidate('connections', 'profile:', 'graph', 'path:', 'stats', 'audit', 'employee-conn', 'teammates');
}

const TYPE_OPTIONS = (t) => Object.entries(CONNECTION_TYPES).filter(([k]) => k !== 'TEAMMATE').map(([value, c]) => ({ value, label: t(c.label) }));

// Tạo quan hệ Knows (vai trò hr). TEAMMATE do trigger tự sinh khi cùng dự án nên không chọn tay.
export function CreateConnectionDialog({ open, onClose, fromId, toId }) {
  const t = useT();
  const toast = useToast();
  const [form, setForm] = useState({ from: null, to: null, type: 'COLLEAGUE', strength: 3, notes: '' });
  const [error, setError] = useState(null);
  const [state, setState] = useState(null);
  useEffect(() => {
    if (open) {
      setForm({ from: fromId || null, to: toId || null, type: 'COLLEAGUE', strength: 3, notes: '' });
      setError(null);
    }
  }, [open, fromId, toId]);
  const submit = async () => {
    setState('loading');
    setError(null);
    try {
      await api.createConnection({ from_emp: form.from, to_emp: form.to, connection_type: form.type, strength: form.strength, notes: form.notes.trim() || null });
      setState('success');
      refreshConnections();
      toast.show({ tone: 'success', title: t('Đã tạo kết nối') });
      setTimeout(() => {
        setState(null);
        onClose();
      }, 400);
    } catch (err) {
      setState(null);
      setError(describeError(err, t));
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Tạo kết nối')}
      description={t('Quan hệ có hướng từ người thứ nhất tới người thứ hai. Đồng đội được tạo tự động khi cùng dự án.')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={submit} state={state} disabled={!form.from || !form.to}>
            {t('Tạo kết nối')}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error && (
          <Banner tone="danger" title={error.title} className="span-2">
            {error.message}
          </Banner>
        )}
        <PersonPicker label={t('Từ')} value={form.from} onChange={(v) => setForm((f) => ({ ...f, from: v }))} excludeIds={form.to ? [form.to] : []} required />
        <PersonPicker label={t('Tới')} value={form.to} onChange={(v) => setForm((f) => ({ ...f, to: v }))} excludeIds={form.from ? [form.from] : []} required />
        <Select label={t('Loại kết nối')} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} options={TYPE_OPTIONS(t)} />
        <div className="field">
          <span className="field-label">{t('Độ mạnh')}</span>
          <StrengthMeter value={form.strength} editable onChange={(v) => setForm((f) => ({ ...f, strength: v }))} />
        </div>
        <TextField className="span-2" label={t('Ghi chú')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={200} counter placeholder={t('Ví dụ: cùng làm dự án CRM năm 2024')} />
      </div>
    </Dialog>
  );
}

export function EditConnectionDialog({ open, onClose, connection }) {
  const t = useT();
  const toast = useToast();
  const [form, setForm] = useState({ type: 'COLLEAGUE', strength: 1, notes: '' });
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const auto = String(connection?.notes || '').startsWith('Auto-created');
  useEffect(() => {
    if (open && connection) {
      setForm({ type: connection.connection_type, strength: Number(connection.strength) || 0, notes: auto ? '' : connection.notes || '' });
      setError(null);
    }
  }, [open, connection, auto]);
  if (!connection) return null;
  const submit = async () => {
    setState('loading');
    try {
      const body = {};
      if (form.type !== connection.connection_type) body.connection_type = form.type;
      if (Number(form.strength) !== Number(connection.strength)) body.strength = form.strength;
      if (!auto && (form.notes || null) !== (connection.notes || null)) body.notes = form.notes || null;
      if (!Object.keys(body).length) {
        setState(null);
        onClose();
        return;
      }
      await api.updateConnection(connection.from_emp, connection.to_emp, body);
      refreshConnections();
      toast.show({ tone: 'success', title: t('Đã lưu thay đổi') });
      setState(null);
      onClose();
    } catch (err) {
      setState(null);
      setError(describeError(err, t));
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Sửa kết nối')}
      description={`${connection.from_name || connection.from_emp} → ${connection.to_name || connection.to_emp}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={submit} state={state}>
            {t('Lưu thay đổi')}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {error && (
          <Banner tone="danger" title={error.title} className="span-2">
            {error.message}
          </Banner>
        )}
        {auto && (
          <Banner tone="info" className="span-2">
            {t('Kết nối này do trigger tạo từ dự án chung. Đổi loại hoặc ghi chú có thể làm hệ thống không còn tự đồng bộ nó.')}
          </Banner>
        )}
        <Select label={t('Loại kết nối')} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} options={Object.entries(CONNECTION_TYPES).map(([value, c]) => ({ value, label: t(c.label) }))} />
        <div className="field">
          <span className="field-label">{t('Độ mạnh')}</span>
          <StrengthMeter value={form.strength} editable onChange={(v) => setForm((f) => ({ ...f, strength: v }))} />
        </div>
        {!auto && <TextField className="span-2" label={t('Ghi chú')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={200} counter />}
      </div>
    </Dialog>
  );
}

export function DeleteConnectionDialog({ open, onClose, connection }) {
  const t = useT();
  const toast = useToast();
  const showError = useErrorToast();
  const [state, setState] = useState(null);
  if (!connection) return null;
  const confirm = async () => {
    setState('loading');
    try {
      await api.deleteConnection(connection.from_emp, connection.to_emp);
      refreshConnections();
      toast.show({ tone: 'success', title: t('Đã xoá kết nối') });
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setState(null);
    }
  };
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      state={state}
      title={t('Xoá kết nối giữa {a} và {b}?', { a: connection.from_name, b: connection.to_name })}
      description={t('Đồ thị sẽ không còn cạnh này. Nhật ký thay đổi vẫn ghi lại thao tác xoá.')}
      confirmLabel={t('Xoá kết nối')}
    />
  );
}
