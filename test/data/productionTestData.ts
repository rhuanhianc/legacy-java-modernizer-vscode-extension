/**
 * A collection of carefully formatted Java code examples designed to be compatible
 * with production-quality modernization rules.
 * 
 * These examples precisely match the patterns that production rules would detect,
 * without requiring any simplification of the rules themselves.
 */
export class ProductionTestData {
  
    /**
     * Lambda opportunities formatted for precise matching by LambdaRule
     */
    static readonly lambdaExamples = `
  package com.example.lambda;
  
  import java.util.ArrayList;
  import java.util.Comparator;
  import java.util.List;
  import java.util.function.Runnable;
  import java.util.function.Consumer;
  import java.util.function.Predicate;
  import java.util.function.BiFunction;
  
  public class LambdaTest {
      public void testLambdaOpportunities() {
          // Example 1: Runnable (should be detected by lambda rule)
          Runnable r = new Runnable() {
              @Override
              public void run() {
                  System.out.println("Hello");
              }
          };
  
          // Example 2: Comparator (should be detected by lambda rule)
          Comparator<String> comp = new Comparator<String>() {
              @Override
              public int compare(String s1, String s2) {
                  return s1.length() - s2.length();
              }
          };
  
          // Example 3: Consumer (should be detected by lambda rule)
          Consumer<String> consumer = new Consumer<String>() {
              @Override
              public void accept(String s) {
                  System.out.println(s);
              }
          };
  
          // Example 4: Multiple statements (should be detected by lambda rule)
          Runnable complexTask = new Runnable() {
              @Override
              public void run() {
                  String message = "Hello";
                  System.out.println(message);
              }
          };
  
          // Example 5: Static import opportunity (should be detected by lambda rule)
          Predicate<String> predicate = new Predicate<String>() {
              @Override
              public boolean test(String s) {
                  return s.startsWith("test");
              }
          };
  
          // Example 6: BiFunction with parameter types (should be detected by lambda rule)
          BiFunction<Integer, String, Boolean> func = new BiFunction<Integer, String, Boolean>() {
              @Override
              public Boolean apply(Integer i, String s) {
                  return i.toString().equals(s);
              }
          };
      }
  }`;
  
    /**
     * Stream API opportunities formatted for precise matching by StreamAPIRule
     */
    static readonly streamExamples = `
  package com.example.stream;
  
  import java.util.ArrayList;
  import java.util.HashMap;
  import java.util.List;
  import java.util.Map;
  
  public class StreamTest {
      public void testStreamOpportunities(List<String> strings) {
          // Example 1: Simple forEach (should be detected by stream rule)
          for (String s : strings) {
              System.out.println(s);
          }
  
          // Example 2: forEach with filtering (should be detected by stream rule)
          for (String s : strings) {
              if (s.length() > 5) {
                  System.out.println(s);
              }
          }
  
          // Example 3: forEach with transformation (should be detected by stream rule)
          for (String s : strings) {
              String upper = s.toUpperCase();
              System.out.println(upper);
          }
  
          List<String> result = new ArrayList<>();
  
          // Example 4: forEach with collection (should be detected by stream rule)
          for (String s : strings) {
              result.add(s);
          }
  
          // Example 5: forEach with filter and collect (should be detected by stream rule)
          for (String s : strings) {
              if (s.length() > 10) {
                  result.add(s);
              }
          }
  
          // Example 6: forEach with filter, transform and collect (should be detected by stream rule)
          for (String s : strings) {
              if (s.length() > 10) {
                  result.add(s.toUpperCase());
              }
          }
      }
  }`;
  
    /**
     * Optional opportunities formatted for precise matching by OptionalRule
     */
    static readonly optionalExamples = `
  package com.example.optional;
  
  import java.util.List;
  
  public class OptionalTest {
      public void testOptionalOpportunities(User user, List<String> values) {
          // Example 1: Simple null check (should be detected by optional rule)
          if (user != null) {
              System.out.println(user.getName());
          }
  
          // Example 2: Null check with method call (should be detected by optional rule)
          if (user != null) {
              user.doSomething();
          }
  
          // Example 3: Null check with else (should be detected by optional rule)
          if (user != null) {
              System.out.println(user.getName());
          } else {
              System.out.println("No user found");
          }
  
          // Example 4: Null check with return (should be detected by optional rule)
          String value = null;
          if (user != null) {
              value = user.getName();
          } else {
              value = "unknown";
          }
  
          // Example 5: Complex null check body (should be detected by optional rule)
          if (user != null) {
              String name = user.getName();
              System.out.println("User: " + name);
              user.logAccess();
          }
  
          // Example 6: Null check with variable declaration (should be detected by optional rule)
          String str = "test";
          if (str != null) {
              int length = str.length();
              System.out.println("Length: " + length);
          }
      }
  }
  
  class User {
      private String name;
      
      public String getName() { 
          return name; 
      }
      
      public void doSomething() {
          System.out.println("Doing something");
      }
      
      public void logAccess() {
          System.out.println("Logged access");
      }
  }`;
  
    /**
     * A comprehensive example with all types of modernization opportunities
     */
    static readonly comprehensiveExample = `
  package com.example.comprehensive;
  
  import java.util.ArrayList;
  import java.util.Comparator;
  import java.util.HashMap;
  import java.util.List;
  import java.util.Map;
  import java.util.function.Consumer;
  import java.util.function.Predicate;
  
  public class ComprehensiveTest {
      public void testAllOpportunities(List<String> items, User user) {
          // LAMBDA OPPORTUNITIES
          
          // Lambda opportunity 1: Runnable
          Runnable task = new Runnable() {
              @Override
              public void run() {
                  System.out.println("Running task");
              }
          };
          
          // Lambda opportunity 2: Comparator
          Comparator<String> comparator = new Comparator<String>() {
              @Override
              public int compare(String s1, String s2) {
                  return s1.length() - s2.length();
              }
          };
          
          // Lambda opportunity 3: Consumer
          Consumer<String> consumer = new Consumer<String>() {
              @Override
              public void accept(String s) {
                  System.out.println("Processing: " + s);
              }
          };
          
          // STREAM API OPPORTUNITIES
          
          // Stream opportunity 1: Simple forEach
          for (String item : items) {
              System.out.println(item);
          }
          
          // Stream opportunity 2: forEach with filtering
          List<String> longItems = new ArrayList<>();
          for (String item : items) {
              if (item.length() > 5) {
                  longItems.add(item);
              }
          }
          
          // Stream opportunity 3: forEach with transformation
          List<String> upperItems = new ArrayList<>();
          for (String item : items) {
              upperItems.add(item.toUpperCase());
          }
          
          // OPTIONAL OPPORTUNITIES
          
          // Optional opportunity 1: Simple null check
          if (user != null) {
              System.out.println(user.getName());
          }
          
          // Optional opportunity 2: Null check with else
          if (user != null) {
              processUser(user);
          } else {
              System.out.println("No user to process");
          }
          
          // Optional opportunity 3: Null check with variable
          if (user != null) {
              String name = user.getName();
              System.out.println("User name: " + name);
          }
      }
      
      private void processUser(User user) {
          System.out.println("Processing: " + user.getName());
      }
  }
  
  class User {
      private String name;
      
      public String getName() {
          return name;
      }
  }`;
  }