/*global todomvc */
'use strict';

/**
 * Services that persists and retrieves TODOs from localStorage
 */
todomvc.factory('todoStorage', function ($http) {
  var STORAGE_ID = 'todos-angularjs';

  return {
    get: function () {
      var url = '/todos';
      return $http.get(url);
    },
    create: function (todo) {
      var url = '/todos';
      return $http.post(url, todo);
    },
    update: function (todo) {
      var url = '/todos/' + todo.id;
      return $http.put(url, todo);
    },
    delete: function(id) {
      var url = '/todos/' + id;
      return $http.delete(url);
    }
  };
});
