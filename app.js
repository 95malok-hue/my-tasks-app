import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.APP_CONFIG || {};
const configured = cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("ВСТАВЬ");
const $ = (id) => document.getElementById(id);
const supabase = configured ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
let currentUser = null;
let tasks = [];

function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").hidden = true, 3200);
}
function dateText(value) {
  return new Intl.DateTimeFormat("ru-RU", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}
function remainingText(value) {
  const ms = new Date(value).getTime() + 48*60*60*1000 - Date.now();
  if (ms <= 0) return "Удаление ожидается";
  const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
  return `Удалится через ${h} ч ${m} мин`;
}
function showAuth(message) {
  $("authPanel").hidden = false; $("appPanel").hidden = true;
  if (message) $("authMessage").textContent = message;
}
function showApp() {
  $("authPanel").hidden = true; $("appPanel").hidden = false;
}
async function refresh() {
  if (!supabase || !currentUser) return;
  $("syncStatus").textContent = "Обновляем…";
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", {ascending:false});
  if (error) { toast("Не удалось загрузить задачи: " + error.message); $("syncStatus").textContent = "Ошибка синхронизации"; return; }
  tasks = data || [];
  render();
  $("syncStatus").textContent = "Синхронизировано";
}
function render() {
  const active = tasks.filter(t => !t.completed_at);
  const done = tasks.filter(t => t.completed_at);
  $("activeCount").textContent = active.length;
  $("doneCount").textContent = done.length;
  $("activeLabel").textContent = active.length ? `${active.length} шт.` : "";
  $("activeEmpty").hidden = active.length > 0;
  $("doneEmpty").hidden = done.length > 0;
  $("activeList").replaceChildren(...active.map(t => taskNode(t,false)));
  $("doneList").replaceChildren(...done.map(t => taskNode(t,true)));
}
function taskNode(task, completed) {
  const card = document.createElement("article"); card.className = "task" + (completed ? " completed" : "");
  const check = document.createElement("button"); check.className = "check" + (completed ? " done" : ""); check.textContent = completed ? "✓" : ""; check.setAttribute("aria-label", completed ? "Выполнено" : "Отметить выполненной");
  check.addEventListener("click", async (e) => { e.stopPropagation(); if (!completed) await completeTask(task.id); });
  const main = document.createElement("div"); main.className = "task-main";
  const title = document.createElement("div"); title.className = "task-title"; title.textContent = task.title;
  const preview = document.createElement("div"); preview.className = "task-preview"; preview.textContent = task.description || "Нажми, чтобы открыть описание";
  const created = document.createElement("div"); created.className = "task-time"; created.textContent = "Добавлена: " + dateText(task.created_at);
  main.append(title, preview, created);
  main.addEventListener("click", () => openDetails(task));
  card.append(check, main);
  if (completed) { const timer = document.createElement("div"); timer.className = "remove-time"; timer.textContent = remainingText(task.completed_at); card.append(timer); }
  return card;
}
function openDetails(task) {
  $("detailTitle").textContent = task.title;
  $("detailDescription").textContent = task.description || "Описание не добавлено.";
  $("detailMeta").textContent = `Создана: ${dateText(task.created_at)}${task.completed_at ? " · Выполнена: " + dateText(task.completed_at) : ""}`;
  $("detailDialog").showModal();
}
async function completeTask(id) {
  const { error } = await supabase.from("tasks").update({completed_at:new Date().toISOString()}).eq("id",id);
  if (error) toast("Не удалось отметить задачу: " + error.message);
  else { toast("Задача отмечена выполненной"); await refresh(); }
}
$("closeDialog").addEventListener("click", () => $("detailDialog").close());
$("closeDialogBottom").addEventListener("click", () => $("detailDialog").close());
$("refreshBtn").addEventListener("click", refresh);
$("signInBtn").addEventListener("click", async () => {
  if (!supabase) return showAuth("Сначала настрой config.js и таблицу Supabase.");
  const email=$("email").value.trim(), password=$("password").value;
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error) toast(error.message);
});
$("signUpBtn").addEventListener("click", async () => {
  if (!supabase) return showAuth("Сначала настрой config.js и таблицу Supabase.");
  const email=$("email").value.trim(), password=$("password").value;
  if(password.length<6) return toast("Пароль должен быть не короче 6 символов");
  const {data,error}=await supabase.auth.signUp({email,password});
  if(error) toast(error.message);
  else if(!data.session) toast("Проверь почту и подтверди регистрацию, затем войди.");
  else toast("Аккаунт создан");
});
$("signOutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); currentUser=null; showAuth("Выполнен выход."); });
$("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title=$("taskTitle").value.trim(), description=$("taskDescription").value.trim();
  if(!title) return;
  const {error}=await supabase.from("tasks").insert({user_id:currentUser.id,title,description});
  if(error) toast("Не удалось добавить задачу: "+error.message);
  else { $("taskForm").reset(); toast("Задача добавлена"); await refresh(); }
});

if (!configured) {
  showAuth("Подключение пока не настроено. Вставь URL и ключ Supabase в www/config.js.");
} else {
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser=session?.user || null;
    if(currentUser){ showApp(); refresh(); } else showAuth("Войди или создай аккаунт.");
  });
  supabase.auth.getSession().then(({data}) => {
    currentUser=data.session?.user || null;
    if(currentUser){showApp();refresh();} else showAuth("Войди или создай аккаунт.");
  });
  // Подхватываем изменения, внесённые во второй версии приложения.
  supabase.channel("tasks-live").on("postgres_changes",{event:"*",schema:"public",table:"tasks"},()=>refresh()).subscribe();
}
