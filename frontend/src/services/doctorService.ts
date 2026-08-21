import { api } from './api';
import type { Doctor } from '../types/doctor';

type DoctorsResponse = {
  data: Doctor[];
};

export const getDoctors = async (): Promise<DoctorsResponse> => {
  const response = await api.get<DoctorsResponse>('/doctors');
  return response.data;
};

export const getSelectedDoctor = (): Doctor | null => {
  const storedDoctor = localStorage.getItem('selectedDoctor');

  if (!storedDoctor) {
    return null;
  }

  try {
    const doctor = JSON.parse(storedDoctor) as Doctor;

    if (
      typeof doctor.id !== 'number' ||
      typeof doctor.name !== 'string' ||
      typeof doctor.designation !== 'string'
    ) {
      throw new Error('Invalid doctor profile');
    }

    return doctor;
  } catch {
    localStorage.removeItem('selectedDoctor');
    return null;
  }
};

export const selectDoctor = (doctor: Doctor): void => {
  localStorage.setItem('selectedDoctor', JSON.stringify(doctor));
};

export const clearSelectedDoctor = (): void => {
  localStorage.removeItem('selectedDoctor');
};