'use strict';

const statsModel = require('../../models/statsModel');
const { asyncHandler } = require('../../utils/asyncHandler');

const resumen = asyncHandler(async (req, res) => {
  res.json(await statsModel.obtenerResumen());
});

module.exports = { resumen };
