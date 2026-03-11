function success(data = null, message = "ok") {
  return {
    success: true,
    message,
    data
  }
}

function fail(message = "error", data = null) {
  return {
    success: false,
    message,
    data
  }
}

module.exports = {
  success,
  fail
}