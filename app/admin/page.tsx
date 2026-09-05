"use client";

import { useEffect, useState } from "react";

import { Calendar } from "@/components/Calendar";
import { fromIsoDate, startOfDay } from "@/lib/dates";

// Страница администратора: закрытые для заказов даты.
// Публичной ссылки на неё нет; без пароля показывает только форму входа.

type Status = "loading" | "login" | "ready";

export default function AdminPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/admin/blocked-dates", { cache: "no-store" });
    if (response.status === 401) {
      setStatus("login");
      return;
    }
    const data = await response.json();
    setDates(data.dates ?? []);
    setSavedDates(data.dates ?? []);
    setMessage(data.ok ? null : `Таблица недоступна: ${data.error}`);
    setStatus("ready");
  };

  useEffect(() => {
    void load();
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      setLoginError(
        response.status === 429 ? "Слишком много попыток, подождите минуту" : "Неверный пароль"
      );
      return;
    }
    setPassword("");
    setStatus("loading");
    await load();
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setStatus("login");
  };

  const toggle = (date: string) => {
    setMessage(null);
    setDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()
    );
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/blocked-dates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setMessage(`Не сохранилось: ${data.error ?? response.status}`);
        return;
      }
      setDates(data.dates);
      setSavedDates(data.dates);
      setMessage("Сохранено");
    } catch {
      setMessage("Нет связи с сервером");
    } finally {
      setSaving(false);
    }
  };

  const dirty = dates.join(",") !== savedDates.join(",");
  const today = startOfDay(new Date());
  const isPast = (iso: string) => fromIsoDate(iso) < today;

  if (status === "loading") {
    return <main className="admin"><p>Загрузка…</p></main>;
  }

  if (status === "login") {
    return (
      <main className="admin">
        <form className="admin__card" onSubmit={login}>
          <h1 className="admin__title">Вход</h1>
          <div className="field">
            <label htmlFor="admin-password">Пароль</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            {loginError && <p className="field-error">{loginError}</p>}
          </div>
          <button className="btn" type="submit">Войти</button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="admin__card">
        <div className="admin__header">
          <h1 className="admin__title">Закрытые даты</h1>
          <button className="admin__logout" type="button" onClick={logout}>
            Выйти
          </button>
        </div>
        <p className="admin__hint">
          Нажмите на день, чтобы закрыть или открыть его для заказов. Закрытые дни
          клиенты не смогут выбрать в форме.
        </p>
        <Calendar
          selected={dates}
          onToggle={toggle}
          isDisabled={isPast}
          isBlocked={(iso) => dates.includes(iso)}
        />
        <div className="admin__summary">
          {dates.filter((d) => !isPast(d)).length > 0
            ? `Закрыто дней: ${dates.filter((d) => !isPast(d)).length}`
            : "Все дни открыты"}
        </div>
        {message && <p className={`admin__message${message === "Сохранено" ? " admin__message--ok" : ""}`}>{message}</p>}
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setDates(savedDates)}
            disabled={!dirty || saving}
          >
            Отменить
          </button>
          <button className="btn" type="button" onClick={save} disabled={!dirty || saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </main>
  );
}
