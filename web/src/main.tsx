import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { bind } from "cuelume"
import App from "./App"
import { applyTheme, readTheme } from "./hooks/useSettings"
import "./index.css"

applyTheme(readTheme())
bind()

const qc = new QueryClient({
  defaultOptions: { queries: { refetchInterval: 15_000, retry: 1 } },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
