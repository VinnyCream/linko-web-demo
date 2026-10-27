import { Component } from 'react';
import ErrorPage from './ErrorPage.jsx';

// Lỗi khi render: hiện trang 500 thay vì màn hình trắng. Đổi resetKey (đường dẫn) để thử lại.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, id: null };
  }

  static getDerivedStateFromError(error) {
    return { error, id: Math.random().toString(16).slice(2, 14) };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, id: null });
  }

  render() {
    if (this.state.error) return <ErrorPage code="500" requestId={`ui-${this.state.id}`} />;
    return this.props.children;
  }
}
