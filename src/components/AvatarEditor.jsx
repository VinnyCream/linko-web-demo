import { useEffect, useRef, useState } from 'react';
import { Dialog, ConfirmDialog } from './Dialog.jsx';
import { Button } from './Button.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import { useT } from '../state/prefs.jsx';
import { resizeImage, usePeople } from '../state/people.jsx';
import { useToast } from './Toast.jsx';

// Đổi hoặc xoá ảnh đại diện của chính mình. Kéo thả hoặc chọn tệp, xem trước, cắt vuông 256px.
export default function AvatarEditor({ open, onClose, employeeId, name }) {
  const t = useT();
  const { avatarOf, setAvatar } = usePeople();
  const toast = useToast();
  const current = avatarOf(employeeId);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    if (open) {
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const load = async (file) => {
    setError(null);
    try {
      setPreview(await resizeImage(file));
    } catch (err) {
      setError(err.message === 'size' ? t('Ảnh lớn hơn 8 MB. Chọn ảnh nhỏ hơn.') : err.message === 'type' ? t('Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.') : t('Không đọc được ảnh này. Thử một ảnh khác.'));
    }
  };

  const save = () => {
    if (!preview) return;
    setAvatar(employeeId, preview);
    toast.show({ tone: 'success', title: t('Đã cập nhật ảnh đại diện') });
    onClose();
  };

  const remove = () => {
    const old = current;
    setAvatar(employeeId, null);
    setConfirmRemove(false);
    onClose();
    toast.show({ tone: 'info', title: t('Đã xoá ảnh đại diện'), action: t('Hoàn tác'), onAction: () => setAvatar(employeeId, old) });
  };

  return (
    <>
      <Dialog
        open={open && !confirmRemove}
        onClose={onClose}
        title={t('Ảnh đại diện')}
        description={t('Ảnh vuông, rõ mặt giúp đồng nghiệp nhận ra bạn. Linko tự cắt giữa và thu nhỏ về 256px.')}
        footer={
          <>
            {current && !preview && (
              <Button variant="ghost" className="mr-auto tone-danger-text" iconStart="trash-can" onClick={() => setConfirmRemove(true)}>
                {t('Xoá ảnh')}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t('Huỷ')}
            </Button>
            <Button variant="primary" onClick={save} disabled={!preview}>
              {t('Lưu ảnh')}
            </Button>
          </>
        }
      >
        <div className="avatar-editor">
          <Avatar name={name} src={preview || current} size="xl" presence={false} />
          <div
            className={`dropzone${drag ? ' is-drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              load(e.dataTransfer.files?.[0]);
            }}
          >
            <Icon name="image" size={20} />
            <p className="t-label">{t('Kéo ảnh vào đây')}</p>
            <p className="muted t-caption">{t('hoặc')}</p>
            <Button size="sm" onClick={() => input.current?.click()}>
              {t('Chọn ảnh từ máy')}
            </Button>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => load(e.target.files?.[0])} />
            {error && (
              <p className="field-error" role="alert">
                <Icon name="circle-exclamation" size={12} filled />
                {error}
              </p>
            )}
          </div>
        </div>
        <p className="muted t-caption">{t('Ảnh đang được lưu trên trình duyệt này cho tới khi backend có API ảnh đại diện.')}</p>
      </Dialog>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        title={t('Xoá ảnh đại diện?')}
        description={t('Đồng nghiệp sẽ thấy chữ cái đầu tên bạn thay cho ảnh.')}
        confirmLabel={t('Xoá ảnh')}
      />
    </>
  );
}
