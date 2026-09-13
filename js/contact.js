/* contact.js — send the form through Web3Forms (works from any static host, including
   GitHub Pages) with transmitting / delivered / failed states. Without JS the form posts natively. */
(function () {
  "use strict";

  var ME = window.ME;
  var ENDPOINT = "https://api.web3forms.com/submit";
  var EMAIL = "mazen.elnaghy@gmail.com";

  function init() {
    var form = document.getElementById("cform");
    if (!form) return;
    var note = document.getElementById("fnote");
    var btn = form.querySelector(".submit");
    var label = form.querySelector(".submit-label");
    var signal = document.getElementById("signal-state");

    function show(kind, text, withEmail) {
      note.className = "formnote mono" + (kind ? " is-" + kind : "");
      note.textContent = text;
      if (withEmail) {
        var a = document.createElement("a");
        a.href = "mailto:" + EMAIL;
        a.textContent = EMAIL;
        note.appendChild(document.createTextNode(" "));
        note.appendChild(a);
      }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (form.querySelector('[name="botcheck"]').checked) return;

      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = value; });

      btn.disabled = true;
      label.textContent = "Transmitting…";
      signal.textContent = "transmitting";
      form.classList.remove("is-sent");
      form.classList.add("is-sending");
      show("", "");

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (!res.ok || !body.success) throw new Error(body.message || "HTTP " + res.status);
          });
        })
        .then(function () {
          form.reset();
          form.classList.add("is-sent");
          signal.textContent = "delivered";
          show("ok", "Signal received. I'll get back to you within a day or two.");
        })
        .catch(function () {
          signal.textContent = "failed";
          show("err", "That didn't go through — email me directly:", true);
        })
        .then(function () {
          btn.disabled = false;
          label.textContent = "Send message";
          form.classList.remove("is-sending");
        });
    });
  }

  ME.contact = { init: init };
})();
