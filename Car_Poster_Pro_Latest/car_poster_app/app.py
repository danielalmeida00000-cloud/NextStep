import streamlit as st
import pandas as pd
from PIL import Image
import requests
from io import BytesIO
from bs4 import BeautifulSoup
import re
import io
import zipfile
import json
from datetime import datetime

st.set_page_config(page_title="Car Poster Pro", page_icon="🚗", layout="wide")

st.markdown("""
<style>
    .main-header {font-size: 2.2rem; font-weight: 700; color: #0F2744;}
    .metric-card {background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #1A73E8;}
</style>
""", unsafe_allow_html=True)

st.markdown('<p class="main-header">🚗 Car Poster Pro</p>', unsafe_allow_html=True)
st.markdown("**Inventory management + Marketplace posting tool for car salespeople**")

# Initialize
if "inventory" not in st.session_state:
    try:
        st.session_state.inventory = pd.read_csv("sample_inventory.csv")
    except:
        st.session_state.inventory = pd.DataFrame()

if "posted" not in st.session_state:
    st.session_state.posted = {}  # track which VINs have been posted

required_cols = ["year", "make", "model", "trim", "price", "mileage", "vin", "stock",
                 "exterior_color", "interior_color", "transmission", "fuel", "description", "image_urls", "notes", "status"]
for col in required_cols:
    if col not in st.session_state.inventory.columns:
        st.session_state.inventory[col] = ""

# ---------- TABS ----------
tab_dash, tab_load, tab_inv, tab_gen = st.tabs(["📊 Dashboard", "Load Inventory", "My Inventory", "Generate Posts"])

# ========== DASHBOARD ==========
with tab_dash:
    st.subheader("Inventory Performance Dashboard")
    df = st.session_state.inventory.copy()

    if df.empty or len(df) == 0:
        st.info("Add vehicles to see your dashboard.")
    else:
        # Clean numeric columns
        df["price_num"] = pd.to_numeric(df["price"], errors="coerce")
        df["mileage_num"] = pd.to_numeric(df["mileage"], errors="coerce")

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Vehicles", len(df))
        with col2:
            avg_price = df["price_num"].mean()
            st.metric("Avg Price", f"${avg_price:,.0f}" if pd.notna(avg_price) else "—")
        with col3:
            total_value = df["price_num"].sum()
            st.metric("Total Inventory Value", f"${total_value:,.0f}" if pd.notna(total_value) else "—")
        with col4:
            posted_count = sum(1 for v in st.session_state.posted.values() if v)
            st.metric("Marked as Posted", posted_count)

        st.divider()
        c1, c2 = st.columns(2)
        with c1:
            st.write("**Top Makes**")
            if "make" in df.columns:
                makes = df["make"].value_counts().head(6)
                st.bar_chart(makes)
        with c2:
            st.write("**Price Distribution**")
            if df["price_num"].notna().any():
                st.bar_chart(df["price_num"].dropna())

        st.subheader("Quick Actions")
        if st.button("Mark all selected as Posted (coming from Generate tab)"):
            st.info("Use the Generate Posts tab to mark vehicles as posted.")

# ========== LOAD INVENTORY ==========
with tab_load:
    st.subheader("Add Vehicles")
    method = st.radio("Source", ["Paste Dealer URL", "Upload CSV"], horizontal=True)

    if method == "Paste Dealer URL":
        url = st.text_input("Inventory URL", placeholder="https://www.towncenternissan.com/used-vehicles-kennesaw-ga")
        if st.button("Extract", type="primary") and url:
            with st.spinner("Extracting..."):
                try:
                    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
                    soup = BeautifulSoup(r.text, "html.parser")
                    lines = [l.strip() for l in soup.get_text("\n").splitlines() if l.strip()]
                    found = []
                    i = 0
                    while i < len(lines):
                        m = re.search(r"\b(20[0-2]\d)\s+(\w+)\s+([A-Za-z0-9\- ]+)", lines[i])
                        if m:
                            year, make, model = int(m.group(1)), m.group(2).title(), m.group(3).strip()
                            price = mileage = 0
                            vin = stock = trim = ""
                            for j in range(1, 15):
                                if i+j >= len(lines): break
                                nxt = lines[i+j]
                                if re.match(r"^[\d,]+$", nxt) and i+j+1 < len(lines) and "mile" in lines[i+j+1].lower():
                                    mileage = int(nxt.replace(",",""))
                                if "$" in nxt:
                                    pm = re.search(r"\$?([\d,]+)", nxt)
                                    if pm: price = int(pm.group(1).replace(",",""))
                                if re.match(r"^[A-HJ-NPR-Z0-9]{17}$", nxt):
                                    vin = nxt
                            if price > 1000 or mileage > 0:
                                found.append({"year":year,"make":make,"model":model,"trim":trim,"price":price,"mileage":mileage,"vin":vin,"stock":stock,"exterior_color":"","description":"","image_urls":"","notes":"","status":"New"})
                        i += 1
                    if found:
                        st.session_state.extracted = found
                        st.success(f"Found {len(found)} vehicles")
                    else:
                        st.warning("No vehicles detected.")
                except Exception as e:
                    st.error(str(e))

        if "extracted" in st.session_state:
            labels = [f"{c['year']} {c['make']} {c['model']} — ${c['price']:,}" for c in st.session_state.extracted]
            picks = st.multiselect("Add these", range(len(labels)), format_func=lambda i: labels[i])
            if st.button("Add to Inventory") and picks:
                new = pd.DataFrame([st.session_state.extracted[i] for i in picks])
                st.session_state.inventory = pd.concat([st.session_state.inventory, new], ignore_index=True)
                st.success(f"Added {len(picks)}")
                del st.session_state.extracted
                st.rerun()
    else:
        up = st.file_uploader("CSV", type="csv")
        if up:
            csv = pd.read_csv(up)
            st.session_state.inventory = pd.concat([st.session_state.inventory, csv], ignore_index=True)
            st.success(f"Added {len(csv)} from CSV")
            st.rerun()

# ========== MY INVENTORY ==========
with tab_inv:
    st.subheader("My Inventory")
    df = st.session_state.inventory.copy()
    if df.empty:
        st.info("No vehicles yet.")
    else:
        search = st.text_input("Search")
        if search:
            df = df[df.astype(str).apply(lambda r: r.str.contains(search, case=False).any(), axis=1)]
        st.dataframe(df[["year","make","model","trim","price","mileage","vin","stock","status"]].fillna(""), use_container_width=True, height=350)

        st.download_button("Export Inventory CSV", df.to_csv(index=False), "inventory.csv")

        # Notes
        st.subheader("Add Note to a Vehicle")
        if not df.empty:
            idx = st.selectbox("Select vehicle", df.index, format_func=lambda i: f"{df.loc[i,'year']} {df.loc[i,'make']} {df.loc[i,'model']}")
            note = st.text_input("Note")
            if st.button("Save Note"):
                st.session_state.inventory.at[idx, "notes"] = note
                st.success("Note saved")

# ========== GENERATE POSTS ==========
with tab_gen:
    st.subheader("Generate Marketplace Posts")
    df = st.session_state.inventory.copy()
    if df.empty:
        st.warning("Add inventory first.")
    else:
        labels = [f"{r['year']} {r['make']} {r['model']} — ${r.get('price','')}" for _, r in df.iterrows()]
        chosen = st.multiselect("Select vehicles", options=df.index.tolist(), format_func=lambda i: labels[list(df.index).index(i)])
        selected = df.loc[chosen] if chosen else pd.DataFrame()

        if not selected.empty:
            style = st.selectbox("Caption style", ["Professional", "Casual", "Short"])
            # Faster workflow
            st.subheader("Quick Posting")
            for idx, row in selected.iterrows():
                title = f"{row.get('year','')} {row.get('make','')} {row.get('model','')}".strip()
                try:
                    price_num = str(int(float(row['price']))) if pd.notna(row.get('price')) else ""
                    price_display = f"${int(float(row['price'])):,}"
                except:
                    price_num = ""
                    price_display = "Call"
                try:
                    miles_num = str(int(float(row['mileage']))) if pd.notna(row.get('mileage')) else ""
                    miles_display = f"{int(float(row['mileage'])):,}"
                except:
                    miles_num = ""
                    miles_display = "N/A"

                caption = f"{title}\n\nPrice: {price_display}\nMileage: {miles_display} miles\n\nClean vehicle. Financing available. Message for details or test drive.\n#{str(row.get('make','')).replace(' ','')} #CarForSale"

                with st.expander(f"📄 {title}", expanded=True):
                    c1, c2, c3 = st.columns(3)
                    with c1:
                        st.code(price_num or price_display, language=None)
                        st.caption("Price — click to copy")
                    with c2:
                        st.code(miles_num or miles_display, language=None)
                        st.caption("Mileage — click to copy")
                    with c3:
                        st.code(str(row.get("vin","")), language=None)
                        st.caption("VIN — click to copy")
                    st.text_area("Description", caption, height=130, key=f"cap{idx}")
                    if st.button("Mark as Posted", key=f"posted{idx}"):
                        vin = str(row.get("vin", idx))
                        st.session_state.posted[vin] = True
                        if idx in st.session_state.inventory.index:
                            st.session_state.inventory.at[idx, "status"] = "Posted"
                        st.success("Marked as posted")

            # Photo download
            if st.button("Download photos for selected cars"):
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, "w") as zf:
                    for _, row in selected.iterrows():
                        urls = [u.strip() for u in str(row.get("image_urls","")).split(",") if u.strip()]
                        safe = f"{row.get('year','')}_{row.get('make','')}_{row.get('model','')}".replace(" ","_")[:30]
                        for i, u in enumerate(urls[:8]):
                            try:
                                resp = requests.get(u, timeout=8)
                                if resp.status_code == 200:
                                    zf.writestr(f"{safe}_{i+1}.jpg", resp.content)
                            except:
                                pass
                zip_buffer.seek(0)
                st.download_button("Save photos.zip", zip_buffer.getvalue(), "car_photos.zip", "application/zip")

            # Extension JSON
            if not selected.empty:
                first = selected.iloc[0]
                payload = {
                    "title": f"{first.get('year','')} {first.get('make','')} {first.get('model','')}",
                    "price": str(first.get("price","")),
                    "mileage": str(first.get("mileage","")),
                    "description": caption,
                    "vin": str(first.get("vin",""))
                }
                st.text_area("JSON for extension (first selected)", json.dumps(payload, indent=2), height=90)

st.caption("Car Poster Pro • Dashboard + Inventory + Posting • Prototype")
