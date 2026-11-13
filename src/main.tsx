import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './auth/AuthProvider'
import { StoreProvider } from './store/StoreProvider'
import App from './App'
// Pretendard: 필요한 글자 조각만 내려받는 방식이라 가벼워요 (한 번 받으면 service worker가 저장)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
