'use strict';

const bcrypt = require('bcryptjs');

const RONDAS = 12;

function hashPassword(passwordPlano) {
  return bcrypt.hash(passwordPlano, RONDAS);
}

function compararPassword(passwordPlano, hash) {
  return bcrypt.compare(passwordPlano, hash);
}

/**
 * Reglas mínimas de complejidad. No son exageradas a propósito: el
 * público objetivo (inventores, estudiantes) no debe sentir fricción,
 * pero sí evitamos contraseñas triviales.
 */
function validarFortaleza(passwordPlano) {
  if (typeof passwordPlano !== 'string' || passwordPlano.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[a-zA-Z]/.test(passwordPlano) || !/[0-9]/.test(passwordPlano)) {
    return 'La contraseña debe combinar letras y números.';
  }
  return null; // válida
}

module.exports = { hashPassword, compararPassword, validarFortaleza };
