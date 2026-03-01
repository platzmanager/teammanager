-- Rename gender_enum values: damen -> female, herren -> male
alter type gender_enum rename value 'damen' to 'female';
alter type gender_enum rename value 'herren' to 'male';
