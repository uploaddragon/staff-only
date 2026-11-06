import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useNotices } from '../lib/useNotices'
import { useStore } from '../store/StoreProvider'

const icons = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  shelf: <path d="M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z" />,
  notice: <path d="M4 5h16v11H8l-4 4zM8 9h8M8 12h5" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
}

const tabs = [
  { to: '/', label: '홈', icon: icons.home },
  { to: '/shelf', label: '매대', icon: icons.shelf },
  { to: '/notices', label: '공지', icon: icons.notice },
  { to: '/settings', label: '설정', icon: icons.settings },
]

export default function TabBar() {
  const location = useLocation()
  const { active } = useStore()
  const isStaff = active?.role === 'staff'
  const { notices, reload } = useNotices(isStaff ? active.store_id : undefined)
  const unread = notices.filter((n) => n.is_required && !n.readByMe).length

  // 화면을 옮길 때마다 다시 세요 (공지에서 '확인했어요'를 누르면 점이 사라지게)
  useEffect(() => {
    if (isStaff) reload()
  }, [location.pathname, isStaff, reload])

  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
        >
          <span className="tab-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            {t.to === '/notices' && unread > 0 && <span className="tab-dot" aria-label={`안 읽은 필독 공지 ${unread}건`} />}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
