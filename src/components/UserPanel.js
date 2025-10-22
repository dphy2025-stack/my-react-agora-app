import React, { useState, useEffect } from "react";

const UserPanel = ({ onNameSubmit }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(localStorage.getItem("username") || "");

  const handleSubmit = () => {
    if (!name.trim()) return alert("لطفاً نام خود را وارد کنید");
    localStorage.setItem("username", name);
    onNameSubmit(name);
    setOpen(false);
  };

  return (
    <>
      {/* دکمه ۳ خط */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999 }}>
        <button onClick={() => setOpen(!open)} style={{ fontSize: "25px", padding: "5px 10px", cursor: "pointer" }}>
          ☰
        </button>
      </div>

      {/* پنل باز شونده */}
      {open && (
        <div style={{ position: "fixed", top: 0, right: 0, width: "250px", height: "100vh", backgroundColor: "#1e2c3c", color: "white", padding: "20px", boxShadow: "-3px 0 10px rgba(0,0,0,0.3)", transition: "0.3s" }}>
          <h3>پنل کاربری</h3>
          {!localStorage.getItem("username") && (
            <>
              <input
                dir="rtl"
                placeholder="نام خود را وارد کنید"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: "8px", margin: "10px 0", borderRadius: "6px", border: "none" }}
              />
              <button onClick={handleSubmit} style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "#007bff", color: "white", border: "none", cursor: "pointer" }}>
                ثبت نام
              </button>
            </>
          )}
          <div style={{ marginTop: "20px" }}>
            <button style={{ width: "100%", padding: "10px", borderRadius: "6px", marginBottom: "10px", cursor: "pointer" }}>پنل کاربر</button>
            <button style={{ width: "100%", padding: "10px", borderRadius: "6px", cursor: "pointer" }}>پنل ادمین</button>
          </div>
        </div>
      )}
    </>
  );
};

export default UserPanel;