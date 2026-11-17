/* Default and fallback Athens configuration. All city configurations use the
   city-config-[city].js filename pattern.
   Coordinates use [longitude, latitude]. Choose points near public roads so
   the global driving router can snap them to a connected road network. */
window.OPOKU_CONFIG={
  city:{
    name:'Athens',
    timeZone:'Europe/Athens',
    center:[23.7275,37.9838],
    zoom:15.7,
    routeIntervalMs:12000,
    minimumRouteDistanceMeters:2500,
    places:[
      ['Syntagma',[23.7353,37.9755]],['Koukaki',[23.725,37.963]],
      ['Pangrati',[23.7505,37.9705]],['Kypseli',[23.7383,38.002]],
      ['Gazi',[23.7104,37.9795]],['Kallithea',[23.7006,37.955]],
      ['Nea Smyrni',[23.7141,37.9466]],['Palaio Faliro',[23.7014,37.928]],
      ['Chalandri',[23.8007,38.0216]],['Marousi',[23.8078,38.05]],
      ['Galatsi',[23.752,38.014]],['Peristeri',[23.6913,38.013]],
      ['Piraeus',[23.6469,37.944]],['Zografou',[23.77,37.977]],
      ['Agia Paraskevi',[23.8212,38.013]],['Alimos',[23.717,37.916]]
    ]
  }
};
