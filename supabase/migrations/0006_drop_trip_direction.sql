-- El sentido (ida/vuelta) lo elige el cobrador en la app antes de cobrar,
-- ya no se define al programar el viaje.
alter table trips drop column direction;
