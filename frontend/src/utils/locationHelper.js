export const getFullStateName = (stateCode) => {
    if (!stateCode) return 'N/A';
    const states = {
        'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam', 'BR': 'Bihar', 'CG': 'Chhattisgarh',
        'GA': 'Goa', 'GJ': 'Gujarat', 'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JH': 'Jharkhand',
        'KA': 'Karnataka', 'KL': 'Kerala', 'MP': 'Madhya Pradesh', 'MH': 'Maharashtra', 'MN': 'Manipur',
        'ML': 'Meghalaya', 'MZ': 'Mizoram', 'NL': 'Nagaland', 'OD': 'Odisha', 'PB': 'Punjab',
        'RJ': 'Rajasthan', 'SK': 'Sikkim', 'TN': 'Tamil Nadu', 'TG': 'Telangana', 'TR': 'Tripura',
        'UP': 'Uttar Pradesh', 'UK': 'Uttarakhand', 'WB': 'West Bengal', 'AN': 'Andaman and Nicobar Islands',
        'CH': 'Chandigarh', 'DN': 'Dadra and Nagar Haveli and Daman and Diu', 'DL': 'Delhi', 'JK': 'Jammu and Kashmir',
        'LA': 'Ladakh', 'LD': 'Lakshadweep', 'PY': 'Puducherry'
    };
    const upperCode = stateCode.toUpperCase();
    return states[upperCode] || stateCode;
};
