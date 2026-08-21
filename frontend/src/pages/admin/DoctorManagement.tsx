import { useEffect, useState } from 'react';

import AppHeader from '../../components/layout/AppHeader';
import {
  createDoctor,
  getAdminDoctors,
  updateDoctor,
  type AdminDoctor,
} from '../../services/adminDoctorService';

type DoctorForm = {
  name: string;
  designation: string;
  active: boolean;
};

const EMPTY_FORM: DoctorForm = {
  name: '',
  designation: '',
  active: true,
};

export default function DoctorManagement() {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<AdminDoctor | null>(null);
  const [formData, setFormData] = useState<DoctorForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        setError('');
        setDoctors(await getAdminDoctors());
      } catch {
        setError('Unable to load doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadDoctors();
  }, []);

  const openCreateForm = () => {
    setEditingDoctor(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setSuccessMessage('');
    setShowForm(true);
  };

  const openEditForm = (doctor: AdminDoctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      designation: doctor.designation,
      active: doctor.active,
    });
    setFormError('');
    setSuccessMessage('');
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingDoctor(null);
    setFormError('');
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formData.name.trim();
    const designation = formData.designation.trim();

    if (!name) {
      setFormError('Doctor name is required.');
      return;
    }

    if (!designation) {
      setFormError('Designation is required.');
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    setSuccessMessage('');

    try {
      if (editingDoctor) {
        const updatedDoctor = await updateDoctor(editingDoctor.id, {
          name,
          designation,
          active: formData.active,
        });
        setDoctors((current) => current.map((doctor) => (
          doctor.id === updatedDoctor.id ? updatedDoctor : doctor
        )));
        setSuccessMessage('Doctor updated successfully.');
      } else {
        const createdDoctor = await createDoctor(name, designation);
        setDoctors((current) => [...current, createdDoctor]);
        setSuccessMessage('Doctor added successfully.');
      }

      setShowForm(false);
      setEditingDoctor(null);
      setFormData(EMPTY_FORM);
    } catch {
      setFormError(editingDoctor
        ? 'Unable to update the doctor. Please try again.'
        : 'Unable to add the doctor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppHeader role="Admin" />
      <main className="app-page">
        <div className="app-page__inner">
          <div className="admin-page-heading">
            <div>
              <p className="eyebrow">Admin Portal</p>
              <h1 className="page-title">Doctors</h1>
            </div>
            <button className="primary-button" type="button" onClick={openCreateForm}>
              + Add Doctor
            </button>
          </div>

          {successMessage && <div className="notice">{successMessage}</div>}
          {error && <div className="alert">{error}</div>}

          <section className="panel">
            {loading ? (
              <div className="empty-state">Loading doctors...</div>
            ) : doctors.length === 0 ? (
              <div className="empty-state">No doctors have been added.</div>
            ) : (
              <div className="table-wrap">
                <table className="doctor-management-table">
                  <thead>
                    <tr>
                      <th>Doctor Name</th>
                      <th>Designation</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doctor) => (
                      <tr key={doctor.id}>
                        <td>{doctor.name}</td>
                        <td>{doctor.designation}</td>
                        <td><span className={`status${doctor.active ? '' : ' status--inactive'}`}>{doctor.active ? 'Active' : 'Inactive'}</span></td>
                        <td><button className="quiet-button" type="button" onClick={() => openEditForm(doctor)}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeForm}>
          <section className="doctor-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="doctor-modal__heading">
              <div>
                <p className="eyebrow">Admin Portal</p>
                <h2 id="doctor-modal-title">{editingDoctor ? 'Edit Doctor' : 'Add Doctor'}</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Close" onClick={closeForm}>x</button>
            </div>

            <form className="doctor-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Doctor Name</span>
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Dr. New Doctor" />
              </label>
              <label className="field">
                <span>Designation</span>
                <input name="designation" value={formData.designation} onChange={handleChange} placeholder="MD, Dermatology" />
              </label>
              {editingDoctor && (
                <label className="doctor-active-toggle">
                  <input name="active" type="checkbox" checked={formData.active} onChange={handleChange} />
                  <span>Active</span>
                </label>
              )}
              {formError && <div className="alert">{formError}</div>}
              <div className="actions doctor-form__actions">
                <button className="quiet-button" type="button" onClick={closeForm}>Cancel</button>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : editingDoctor ? 'Save' : 'Add Doctor'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}