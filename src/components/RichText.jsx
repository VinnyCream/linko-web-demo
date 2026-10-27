import { Link } from '../lib/router.jsx';
import { usePeople } from '../state/people.jsx';

// Văn bản thuần: @[Tên] thành liên kết hồ sơ, #[Dự án] thành liên kết dự án, https:// thành liên kết ngoài.
// Không bao giờ dựng HTML từ nội dung người dùng (chống XSS).
const TOKEN = /(@\[[^\]]{1,80}\]|#\[[^\]]{1,120}\]|https:\/\/[^\s]+)/g;

export default function RichText({ text }) {
  const { people, projects } = usePeople();
  const parts = String(text || '').split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@[')) {
          const name = part.slice(2, -1);
          const person = people.find((p) => p.full_name === name);
          return person ? (
            <Link key={i} to={`/people/${person.employee_id}`} className="mention">@{name}</Link>
          ) : (
            <span key={i} className="mention">@{name}</span>
          );
        }
        if (part.startsWith('#[')) {
          const name = part.slice(2, -1);
          const project = projects.find((p) => p.project_name === name);
          return project ? (
            <Link key={i} to={`/projects/${project.project_id}`} className="tag-link">#{name}</Link>
          ) : (
            <span key={i} className="tag-link">#{name}</span>
          );
        }
        if (part.startsWith('https://')) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="link">
              {part.replace(/^https:\/\//, '')}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
