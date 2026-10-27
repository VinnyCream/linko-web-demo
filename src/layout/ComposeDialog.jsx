import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog.jsx';
import { Button } from '../components/Button.jsx';
import { SegmentedControl, TextField } from '../components/Form.jsx';
import Avatar from '../components/Avatar.jsx';
import { useT } from '../state/prefs.jsx';
import { useSession } from '../auth/session.jsx';
import { useSocial } from '../state/social.jsx';
import { useToast } from '../components/Toast.jsx';
import { readStore, writeStore } from '../lib/storage.js';

const MAX = 2000;

// Soạn bài viết. Nháp được giữ lại nếu lỡ đóng hộp thoại.
export default function ComposeDialog({ open, onClose }) {
  const t = useT();
  const session = useSession();
  const social = useSocial();
  const toast = useToast();
  const [text, setText] = useState('');
  const [audience, setAudience] = useState('company');
  const [state, setState] = useState(null);

  useEffect(() => {
    if (open) setText(readStore('draft-post', '') || '');
  }, [open]);

  const close = () => {
    writeStore('draft-post', text.trim() ? text : null);
    onClose();
  };

  const submit = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setState('loading');
    setTimeout(() => {
      social.addPost(text.trim(), audience);
      writeStore('draft-post', null);
      setState(null);
      setText('');
      onClose();
      toast.show({ tone: 'success', title: t('Đã đăng') });
    }, 450);
  };

  const name = session.me?.full_name || session.subject || '';
  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('Tạo bài viết')}
      size="lg"
      footer={
        <>
          <span className="muted t-caption compose-hint">{t('Dùng @[Tên] để nhắc đồng nghiệp, #[Dự án] để gắn dự án.')}</span>
          <Button variant="ghost" onClick={close}>
            {t('Huỷ')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!text.trim() || text.length > MAX} state={state} iconStart="paper-plane">
            {t('Đăng')}
          </Button>
        </>
      }
    >
      <form className="compose" onSubmit={submit}>
        <div className="compose-who">
          <Avatar id={session.me?.employee_id} name={name} size="md" />
          <div>
            <p className="t-label">{name}</p>
            <SegmentedControl
              size="sm"
              label={t('Ai xem được')}
              value={audience}
              onChange={setAudience}
              options={[
                { value: 'company', label: t('Toàn công ty'), icon: 'globe' },
                { value: 'dept', label: t('Phòng ban'), icon: 'building' },
                { value: 'project', label: t('Dự án'), icon: 'folder' },
              ]}
            />
          </div>
        </div>
        <TextField
          multiline
          rows={6}
          label={t('Nội dung')}
          placeholder={t('Bạn muốn chia sẻ gì với đồng nghiệp?')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX}
          counter
          data-autofocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
      </form>
    </Dialog>
  );
}
