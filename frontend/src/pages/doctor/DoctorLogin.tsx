import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getDoctors, selectDoctor } from '../../services/doctorService';
import type { Doctor } from '../../types/doctor';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const response = await getDoctors();
        setDoctors(response.data);
      } catch (error) {
        console.error('Error loading doctor profiles:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDoctors();
  }, []);

  const handleDoctorSelect = (doctor: Doctor) => {
    selectDoctor(doctor);
    navigate('/doctor', { replace: true });
  };

  return (
    <main className="login-page">
      <div className="login-panel doctor-login-panel">
        <div className="brand">
          <img src="/images/iad-logo.png" alt="Institute of Applied Dermatology" />
        </div>
        <div className="page-intro">
          <p className="eyebrow">Hospital costing</p>
          <h1 className="page-title">Doctor Login</h1>
          <p className="page-subtitle">Select your profile to continue.</p>
        </div>

        {isLoading && <div className="empty-state">Loading doctors...</div>}
        {!isLoading && hasError && <div className="alert">Unable to load doctor profiles.</div>}
        {!isLoading && !hasError && doctors.length === 0 && (
          <div className="empty-state">No active doctors are available.</div>
        )}
        {!isLoading && !hasError && doctors.length > 0 && (
          <div className="doctor-list" aria-label="Active doctors">
            {doctors.map((doctor) => (
              <button className="doctor-card" type="button" key={doctor.id} onClick={() => handleDoctorSelect(doctor)}>
                <span>
                  <strong>{doctor.name}</strong>
                  <small>{doctor.designation}</small>
                </span>
                <span className="doctor-card__action">Select <span aria-hidden="true">-&gt;</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}