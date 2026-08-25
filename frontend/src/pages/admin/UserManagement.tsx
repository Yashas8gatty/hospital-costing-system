import { useEffect, useState } from 'react';
import AppHeader from '../../components/layout/AppHeader';
import { createUser, getUsers, updateUser, type AdminUser } from '../../services/adminUserService';

const blank = { name: '', username: '', designation: '', password: '', role: 'USER' as AdminUser['role'] };

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadUsers = async () => {
      try { setUsers(await getUsers()); } catch { setError('Unable to load users.'); } finally { setLoading(false); }
    };
    void loadUsers();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const result = editing
        ? await updateUser(editing.id, { ...form, password: form.password || undefined })
        : await createUser(form);
      setUsers((current) => editing ? current.map((user) => user.id === result.id ? result : user) : [...current, result]);
      setEditing(null); setForm(blank);
    } catch { setError('Unable to save user. Check the username and fields.'); }
  };
  const edit = (user: AdminUser) => { setEditing(user); setForm({ name: user.name, username: user.username, designation: user.designation, password: '', role: user.role }); };
  return <><AppHeader role="Admin" /><main className="app-page"><div className="app-page__inner">
    <div className="admin-page-heading"><div><p className="eyebrow">Admin Portal</p><h1 className="page-title">Users</h1></div></div>
    {error && <div className="alert">{error}</div>}
    <section className="panel"><form className="form-grid" onSubmit={submit}>
      <label className="field"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label className="field"><span>Username</span><input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
      <label className="field"><span>Designation</span><input required value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
      <label className="field"><span>{editing ? 'New Password (optional)' : 'Password'}</span><input required={!editing} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      <label className="field"><span>Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminUser['role'] })}><option value="USER">User</option><option value="ADMIN">Admin</option></select></label>
      <div className="actions"><button className="primary-button" type="submit">{editing ? 'Save User' : 'Create User'}</button>{editing && <button className="quiet-button" type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}</div>
    </form></section>
    <section className="panel">{loading ? <div className="empty-state">Loading users...</div> : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Designation</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.username}</td><td>{user.designation}</td><td>{user.role}</td><td>{user.active ? 'Active' : 'Inactive'}</td><td><button className="quiet-button" type="button" onClick={() => edit(user)}>Edit</button><button className="quiet-button" type="button" onClick={() => void updateUser(user.id, { active: !user.active }).then((updated) => setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))).catch(() => setError('Unable to update user status.'))}>{user.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}</section>
  </div></main></>;
}
